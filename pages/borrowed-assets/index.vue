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
          placeholder="Search by Ref #, borrower, item, status..."
          clearable
          density="compact"
          class="mb-4"
          hide-details
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="transactions"
          :items-length="totalItems"
          :loading="loading"
          @update:options="loadTransactions"
          class="elevation-1 mt-4"
          item-value="_id"
        >
          <template v-slot:item.reference_number="{ item }">
             <span class="font-weight-medium text-caption copyable-id" @click="copyToClipboard(item._id)" title="Click to copy ID">
                {{ item._id }}
                <v-icon size="x-small" class="ml-1">mdi-content-copy</v-icon>
            </span>
          </template>

          <template v-slot:item.borrow_datetime="{ item }">
            {{ formatDate(item.borrow_datetime) }}
          </template>

          <template v-slot:item.date_returned="{ item }">
            {{ item.date_returned ? formatDate(item.date_returned) : 'Not Yet Returned' }}
          </template>

          <template v-slot:item.status="{ item }">
            <v-select
                :model-value="item.status"
                :items="BORROW_STATUS_OPTIONS"
                @update:modelValue="(newStatus) => updateTransactionStatus(item, newStatus)"
                density="compact"
                variant="outlined"
                hide-details
                class="status-select"
                :disabled="updatingStatusFor === item._id"
                :loading="updatingStatusFor === item._id"
            >
                <template v-slot:selection="{ item: selItem }">
                    <v-chip :color="getStatusColor(selItem.value)" small label>
                        {{ selItem.title }}
                    </v-chip>
                </template>
            </v-select>
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" size="small" :to="`/borrowed-assets/${item._id}`" prepend-icon="mdi-eye-outline">
              View/Manage
            </v-btn>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" class="ma-3" border="start" prominent>
                No borrowing transactions found matching your criteria.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path as needed
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const transactions = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null); // ID of the transaction being updated

const BORROW_STATUS_OPTIONS = ['Borrowed', 'Returned', 'Overdue', 'Lost', 'Damaged'];

const headers = ref([
  { title: 'Ref #', key: 'reference_number', sortable: false, width: '200px'},
  { title: 'Borrower Name', key: 'borrower_name', sortable: true }, // API should provide this (e.g., via $lookup)
  { title: 'Item Borrowed', key: 'item_borrowed', sortable: true }, // API should provide this (e.g., via $lookup if item_id is stored)
  { title: 'Date Borrowed', key: 'borrow_datetime', sortable: true },
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '180px' },
  { title: 'Borrowed From', key: 'borrowed_from_personnel', sortable: true }, // API should provide this
  { title: 'Date Returned', key: 'date_returned', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '150px' },
]);

let searchDebounceTimer = null;
let currentSortBy = ref([{ key: 'borrow_datetime', order: 'desc' }]); // Default sort

watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadTransactions({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }, 500);
});

async function loadTransactions(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;

  if (sortBy && sortBy.length) {
    currentSortBy.value = sortBy;
  }

  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
  };

  // if (currentSortBy.value && currentSortBy.value.length > 0) {
  //   queryParams.sortBy = currentSortBy.value[0].key;
  //   queryParams.sortOrder = currentSortBy.value[0].order;
  // } else {
  //   queryParams.sortBy = 'borrow_datetime';
  //   queryParams.sortOrder = 'desc';
  // }

  try {
    const { data, error } = await useMyFetch('/api/borrowed-assets', { query: queryParams });
    if (error.value) {
      console.error('Failed to load transactions:', error.value);
      $toast.fire({ title: 'Failed to load transactions.', icon: 'error'});
      transactions.value = []; totalItems.value = 0;
    } else if (data.value) {
      transactions.value = data.value.transactions || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception loading transactions:', e);
    $toast.fire({ title: 'An error occurred.', icon: 'error'});
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
  const colors = {
    'Borrowed': 'orange-darken-1',
    'Returned': 'green-darken-1',
    'Overdue': 'red-darken-2',
    'Lost': 'error',
    'Damaged': 'warning',
  };
  return colors[status] || 'grey';
};

async function updateTransactionStatus(transactionItem, newStatus) {
  if (transactionItem.status === newStatus) return;

  const originalStatus = transactionItem.status;
  updatingStatusFor.value = transactionItem._id;

  const itemIndex = transactions.value.findIndex(t => t._id === transactionItem._id);
  if (itemIndex > -1) {
    transactions.value[itemIndex].status = newStatus;
    // Optimistically update date_returned if status is 'Returned'
    if (newStatus === 'Returned' && !transactions.value[itemIndex].date_returned) {
        transactions.value[itemIndex].date_returned = new Date().toISOString();
    }
  }

  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value || (data.value && data.value.error)) {
      if (itemIndex > -1) {
        transactions.value[itemIndex].status = originalStatus; // Revert
        // Also revert date_returned if it was optimistically set
        if (newStatus === 'Returned' && originalStatus !== 'Returned') {
            transactions.value[itemIndex].date_returned = transactionItem.date_returned; // original date_returned
        }
      }
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to update status.', icon: 'error' });
    } else {
      $toast.fire({ title: data.value?.message || 'Status updated successfully!', icon: 'success' });
      if (data.value && data.value.updatedTransaction && itemIndex > -1) {
         transactions.value[itemIndex] = { ...transactions.value[itemIndex], ...data.value.updatedTransaction };
      } else if (itemIndex > -1) {
         transactions.value[itemIndex].status = newStatus; // Ensure status is final
         if (newStatus === 'Returned' && !transactions.value[itemIndex].date_returned) { // Set from API if not present
            transactions.value[itemIndex].date_returned = new Date().toISOString();
         }
      }
    }
  } catch (e) {
    if (itemIndex > -1) {
        transactions.value[itemIndex].status = originalStatus;
        if (newStatus === 'Returned' && originalStatus !== 'Returned') {
            transactions.value[itemIndex].date_returned = transactionItem.date_returned;
        }
    }
    console.error('Exception updating transaction status:', e);
    $toast.fire({ title: 'An error occurred while updating status.', icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    $toast.fire({ title: 'Reference # copied!', icon: 'success', timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error('Failed to copy text: ', err);
    $toast.fire({ title: 'Failed to copy.', icon: 'error' });
  }
}
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.status-select {
    min-width: 180px; /* Adjust for status names */
    max-width: 200px;
}
.copyable-id {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    transition: color 0.2s ease-in-out;
}
.copyable-id:hover {
    color: rgb(var(--v-theme-primary));
}
.copyable-id .v-icon {
    opacity: 0.6;
    transition: opacity 0.2s ease-in-out;
}
.copyable-id:hover .v-icon {
    opacity: 1;
}
</style>