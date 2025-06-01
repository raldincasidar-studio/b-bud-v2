<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Borrowed Assets Log</h2></v-col>
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/borrowed-assets/new" prepend-icon="mdi-plus-circle-outline" color="primary">
          Log New Borrowing
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-archive-arrow-down-outline" class="mr-2"></v-icon>
        Transaction History
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Transactions"
          placeholder="Search by borrower, item, status..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="transactions"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey"
          @update:options="loadTransactions"
          class="elevation-1"
          item-value="_id"
        >
          <template v-slot:item.borrow_datetime="{ item }">
            {{ formatDate(item.borrow_datetime) }}
          </template>
          <template v-slot:item.date_returned="{ item }">
            {{ item.date_returned ? formatDate(item.date_returned) : 'N/A' }}
          </template>
          <template v-slot:item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" small label>{{ item.status }}</v-chip>
          </template>
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/borrowed-assets/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Edit
            </v-btn>
          </template>
          <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No borrowing transactions found.</v-alert>
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
const transactions = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const headers = ref([
  { title: 'Borrower Name', key: 'borrower_name', sortable: true },
  { title: 'Item Borrowed', key: 'item_borrowed', sortable: true },
  { title: 'Date Borrowed', key: 'borrow_datetime', sortable: true },
  { title: 'Status', key: 'status', sortable: true, align: 'center' },
  { title: 'Borrowed From', key: 'borrowed_from_personnel', sortable: true },
  { title: 'Date Returned', key: 'date_returned', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadTransactions({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500);
});

async function loadTransactions(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy, search } = options;
  const currentSearchTerm = searchKey.value;

  try {
    const { data, error } = await useMyFetch('/api/borrowed-assets', {
      query: {
        search: currentSearchTerm,
        page: page,
        itemsPerPage: rpp,
        // Add sortBy and sortOrder if API supports
      },
    });
    if (error.value) {
      console.error('Failed to load transactions:', error.value);
      transactions.value = []; totalItems.value = 0;
    } else if (data.value) {
      transactions.value = data.value.transactions || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading transactions:', e);
    transactions.value = []; totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleString(undefined, options);
  } catch (e) { return dateString; }
};

const getStatusColor = (status) => {
  if (status === 'Borrowed') return 'orange';
  if (status === 'Returned') return 'green';
  if (status === 'Overdue') return 'red';
  return 'grey';
};
</script>