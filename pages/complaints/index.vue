<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Complaint Log</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/complaints/new" prepend-icon="mdi-comment-alert-outline" color="primary">
          New Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-file-chart-outline" class="mr-2"></v-icon>
        Complaint History
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Complaints"
          placeholder="Search by complainant, person complained, status..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="complaints"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey"
          @update:options="loadComplaints"
          class="elevation-1"
          item-value="_id"
        >
          <template v-slot:item.date_of_complaint="{ item }">
            {{ formatDate(item.date_of_complaint) }}
          </template>
          <template v-slot:item.notes_description="{ item }">
            <div class="text-truncate" style="max-width: 300px;" :title="item.notes_description">
              {{ item.notes_description }}
            </div>
          </template>
          <template v-slot:item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" small label>{{ item.status }}</v-chip>
          </template>
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/complaints/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Edit
            </v-btn>
          </template>
           <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No complaints found.</v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path

const searchKey = ref('');
const totalItems = ref(0);
const complaints = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const headers = ref([
  { title: 'Complainant Name', key: 'complainant_name', sortable: true },
  { title: 'Person Complained Against', key: 'person_complained_against', sortable: true },
  { title: 'Date of Complaint', key: 'date_of_complaint', sortable: true },
  { title: 'Status', key: 'status', sortable: true, align: 'center' },
  { title: 'Description Preview', key: 'notes_description', sortable: false },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadComplaints({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadComplaints(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options; // search is implicitly from searchKey.value
  const currentSearchTerm = searchKey.value;

  try {
    const { data, error } = await useMyFetch('/api/complaints', {
      query: {
        search: currentSearchTerm,
        page: page,
        itemsPerPage: rpp,
        // Add sortBy logic if API supports it
      },
    });
    if (error.value) {
      console.error('Failed to load complaints:', error.value);
      complaints.value = []; totalItems.value = 0;
    } else if (data.value) {
      complaints.value = data.value.complaints || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading complaints:', e);
    complaints.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => {
  const colors = {
    "New": 'blue',
    "Under Investigation": 'orange',
    "Resolved": 'green',
    "Closed": 'grey',
    "Dismissed": 'red-darken-2'
  };
  return colors[status] || 'default';
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>