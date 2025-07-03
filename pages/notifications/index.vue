<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <!-- UPDATED: More general title -->
        <h2 class="text-h4 font-weight-bold">Notifications</h2>
        <p class="text-grey-darken-1">Manage all news, events, and alerts for residents.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/notifications/new"
          prepend-icon="mdi-bell-plus-outline"
          color="primary"
        >
          <!-- UPDATED: More general button text -->
          New Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-bell-ring-outline" class="mr-2"></v-icon>
        <!-- UPDATED: More general card title -->
        Manage Notifications
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          label="Search Notifications..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
          style="max-width: 350px;"
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <!-- UPDATED: Filter tabs now reflect the new notification types -->
      <v-tabs v-model="typeFilter" color="primary" class="px-4">
        <v-tab
          v-for="item in NOTIFICATION_TYPE_FILTER_OPTIONS"
          :key="item.title"
          :value="item.value"
          :prepend-icon="item.icon" 
          class="text-capitalize"
        >
          {{ item.title }}
        </v-tab>
      </v-tabs>
      <v-divider></v-divider>
      
      <v-card-text>
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="notifications"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadNotifications"
          item-value="_id"
        >
          <template v-slot:item.name="{ item }">
            <strong>{{ item.name }}</strong>
          </template>

          <template v-slot:item.type="{ item }">
            <v-chip :color="getTypeColor(item.type)" small label>{{ item.type }}</v-chip>
          </template>

          <template v-slot:item.content="{ item }">
            <div class="text-truncate" style="max-width: 300px;" :title="item.content">
              {{ item.content }}
            </div>
          </template>

          <template v-slot:item.target_audience="{ item }">
            {{ formatAudience(item.target_audience, item.recipients) }}
          </template>

          <template v-slot:item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              :to="`/notifications/${item._id}`"
            >
              View
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">
                No notifications found matching your criteria.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../composables/useMyFetch'; // Adjust path if needed
import { useNuxtApp } from '#app'; 

const { $toast } = useNuxtApp();

const typeFilter = ref(null); // `null` value corresponds to the "All" tab
const searchKey = ref('');
const totalItems = ref(0);
const notifications = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
let currentSortBy = ref([{ key: 'date', order: 'desc' }]);

// UPDATED: Filter options now match the new notification types
const NOTIFICATION_TYPE_FILTER_OPTIONS = [
    { title: 'All', value: null, icon: 'mdi-filter-variant' }, 
    { title: 'News', value: 'News', icon: 'mdi-newspaper-variant-outline' },
    { title: 'Events', value: 'Events', icon: 'mdi-calendar-star' },
    { title: 'Alert', value: 'Alert', icon: 'mdi-alert-circle-outline' },
];

const headers = ref([
  { title: 'Name/Title', key: 'name', sortable: true, align: 'start' },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Content Preview', key: 'content', sortable: false, width: '30%' },
  { title: 'Target Audience', key: 'target_audience', sortable: false },
  { title: 'Effective Date', key: 'date', sortable: true },
  { title: 'Author', key: 'by', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '100px' },
]);

let searchDebounceTimer = null;
watch([searchKey, typeFilter], () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }, 500); 
});

async function loadNotifications(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;

  if (sortBy && sortBy.length) {
    currentSortBy.value = sortBy;
  }

  try {
    const queryParams = {
        search: searchKey.value,
        page: page,
        itemsPerPage: rpp,
    };
    // If typeFilter is not null, add it to the query
    if (typeFilter.value) { 
        queryParams.type = typeFilter.value;
    }
    
    if (currentSortBy.value && currentSortBy.value.length > 0) {
      queryParams.sortBy = currentSortBy.value[0].key;
      queryParams.sortOrder = currentSortBy.value[0].order;
    }

    const { data, error } = await useMyFetch('/api/notifications', { query: queryParams });

    if (error.value) {
      throw new Error(error.value.data?.message || 'Failed to load notifications.');
    } else if (data.value) {
      notifications.value = data.value.notifications || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    notifications.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

// UPDATED: Added colors for the new notification types
const getTypeColor = (type) => ({
    'News': 'blue-darken-1',
    'Events': 'deep-purple-accent-2',
    'Alert': 'error',
  }[type] || 'grey');
  

// UPDATED: Added human-readable names for the new target audiences
const formatAudience = (target, recipientsArray) => {
    switch(target) {
        case 'All':
            return 'All Approved Residents';
        case 'PWDResidents':
            return 'All PWD Residents';
        case 'SeniorResidents':
            return 'All Senior Citizens';
        case 'VotersResidents':
            return 'All Registered Voters';
        case 'SpecificResidents':
            const count = Array.isArray(recipientsArray) ? recipientsArray.length : 0;
            return `Specific (${count} resident${count === 1 ? '' : 's'})`;
        default:
            return target || 'N/A'; // Fallback for any other case
    }
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>