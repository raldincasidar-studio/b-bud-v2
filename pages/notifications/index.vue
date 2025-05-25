<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Notifications</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          to="/notifications/new"
          prepend-icon="mdi-bell-plus-outline"
          color="primary"
        >
          New Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-bell-ring-outline" class="mr-2"></v-icon>
        Manage Notifications
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Notifications"
          placeholder="Search by name, content, author..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="notifications"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey"
          @update:options="loadNotifications"
          item-value="_id"
        >
          <template v-slot:item.name="{ item }">
            <strong>{{ item.name }}</strong>
          </template>

          <template v-slot:item.content="{ item }">
            <div class="text-truncate" style="max-width: 400px;" :title="item.content">
              {{ item.content }}
            </div>
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
              prepend-icon="mdi-eye-outline"
              title="View/Edit Notification"
            >
              View
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">
                No notifications found.
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

const searchKey = ref('');
const totalItems = ref(0);
const notifications = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const headers = ref([
  { title: 'Name', key: 'name', sortable: true, align: 'start' }, // API default sort is by date
  { title: 'Content Preview', key: 'content', sortable: false, width: '40%' },
  { title: 'Date', key: 'date', sortable: true },
  { title: 'Author', key: 'by', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadNotifications({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadNotifications(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy, search } = options;
  const currentSearchTerm = searchKey.value;

  try {
    const { data, error } = await useMyFetch('/api/notifications', {
      query: {
        search: currentSearchTerm,
        page: page,
        itemsPerPage: rpp,
        // sortBy: (sortBy && sortBy.length > 0) ? sortBy[0].key : undefined, // If API supports dynamic sort
        // sortOrder: (sortBy && sortBy.length > 0) ? sortBy[0].order : undefined,
      },
    });

    if (error.value) {
      console.error('Failed to load notifications:', error.value);
      notifications.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      notifications.value = data.value.notifications || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception while loading notifications:', e);
    notifications.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    return dateString;
  }
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>