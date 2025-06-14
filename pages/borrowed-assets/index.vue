<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Borrowed Assets Log</h2>
        <p class="text-grey-darken-1">Track and manage all asset borrowing requests and history.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          rounded="lg"
          size="large"
          variant="tonal"
          to="/borrowed-assets/new"
          prepend-icon="mdi-plus-circle-outline"
          color="primary"
        >
          New Borrow Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2" border>
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
          label="Search by Borrower, Item, or Status..."
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
          <template v-slot:item.borrow_datetime="{ item }">
            {{ formatDate(item.borrow_datetime) }}
          </template>

          <template v-slot:item.expected_return_date="{ item }">
            {{ formatDate(item.expected_return_date, false) }}
          </template>

          <template v-slot:item.date_returned="{ item }">
            <span v-if="item.date_returned">{{ formatDate(item.date_returned) }}</span>
            <span v-else class="text-grey-darken-1">—</span>
          </template>

          <template v-slot:item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" label size="small" class="font-weight-bold">
              <v-icon start :icon="getStatusIcon(item.status)"></v-icon>
              {{ item.status }}
            </v-chip>
          </template>

          <template v-slot:item.action="{ item }">
            <div class="d-flex justify-center align-center">
              <v-btn
                variant="tonal"
                color="primary"
                size="small"
                :to="`/borrowed-assets/${item._id}`"
                class="me-2 text-capitalize"
              >
                Manage
              </v-btn>
              <v-menu v-if="getAvailableActions(item.status).length > 0" offset-y>
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    v-bind="props"
                    :loading="updatingStatusFor === item._id"
                  ></v-btn>
                </template>
                <v-list density="compact">
                  <v-list-subheader>Quick Actions</v-list-subheader>
                  <v-list-item
                    v-for="action in getAvailableActions(item.status)"
                    :key="action.status"
                    @click="updateTransactionStatus(item, action.status, action.prompt)"
                    :disabled="updatingStatusFor === item._id"
                  >
                    <template v-slot:prepend>
                      <v-icon :icon="action.icon" :color="action.color" size="small"></v-icon>
                    </template>
                    <v-list-item-title>{{ action.title }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </template>

           <template v-slot:no-data>
            <v-alert type="info" class="ma-3" border="start" prominent>
                No borrowing transactions found. Start by creating a new borrow request.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);
const transactions = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null); // ID of the transaction being status-updated

const headers = ref([
  { title: 'Borrower', key: 'borrower_name', sortable: true, width: '15%' },
  { title: 'Item', key: 'item_borrowed', sortable: true, width: '15%' },
  { title: 'Date Borrowed', key: 'borrow_datetime', sortable: true, width: '15%' },
  { title: 'Expected Return', key: 'expected_return_date', sortable: true, width: '15%' },
  { title: 'Actual Return', key: 'date_returned', sortable: true, width: '15%' },
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '12%' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '13%' },
]);

const STATUS_CONFIG = {
  Pending:    { color: 'blue-grey', icon: 'mdi-clock-outline' },
  Processing: { color: 'blue', icon: 'mdi-cogs' },
  Approved:   { color: 'orange', icon: 'mdi-check-circle-outline' },
  Returned:   { color: 'green-darken-1', icon: 'mdi-check-all' },
  Overdue:    { color: 'red-darken-2', icon: 'mdi-alert-octagon-outline' },
  Lost:       { color: 'black', icon: 'mdi-help-rhombus-outline' },
  Damaged:    { color: 'amber-darken-4', icon: 'mdi-alert-decagram-outline' },
  Resolved:   { color: 'teal', icon: 'mdi-handshake-outline' },
  Rejected:   { color: 'red-lighten-1', icon: 'mdi-cancel' },
};

const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'grey';
const getStatusIcon = (status) => STATUS_CONFIG[status]?.icon || 'mdi-help-circle-outline';

const getAvailableActions = (currentStatus) => {
  const actions = [];
  switch (currentStatus) {
    case 'Pending':
      actions.push({ status: 'Processing', title: 'Start Processing', icon: 'mdi-cogs', color: 'blue' });
      actions.push({ status: 'Rejected', title: 'Reject Request', icon: 'mdi-cancel', color: 'red' });
      break;
    case 'Processing':
      actions.push({ status: 'Approved', title: 'Approve & Release Item', icon: 'mdi-check-circle', color: 'green' });
      actions.push({ status: 'Pending', title: 'Return to Pending', icon: 'mdi-arrow-left', color: 'blue-grey' });
      break;
    case 'Approved':
    case 'Overdue':
      actions.push({ status: 'Damaged', title: 'Mark as Damaged', icon: getStatusIcon('Damaged'), color: getStatusColor('Damaged'), prompt: true });
      actions.push({ status: 'Lost', title: 'Mark as Lost', icon: getStatusIcon('Lost'), color: getStatusColor('Lost'), prompt: true });
      break;
    case 'Lost':
    case 'Damaged':
      actions.push({ status: 'Resolved', title: 'Mark as Resolved', icon: getStatusIcon('Resolved'), color: getStatusColor('Resolved'), prompt: true });
      break;
  }
  return actions;
};

let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadTransactions({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  }, 500);
});

async function loadTransactions(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy } = options;
  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
  };

  try {
    const { data, error } = await useMyFetch('/api/borrowed-assets', { query: queryParams });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to load transactions.');
    
    transactions.value = data.value.transactions || [];
    totalItems.value = data.value.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    transactions.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

async function updateTransactionStatus(transactionItem, newStatus, prompt = false) {
  if (prompt) {
    const result = await $toast.fire({
      title: `Confirm Action: ${newStatus}`,
      html: `This will mark item <b>${transactionItem.item_borrowed}</b> as <b>${newStatus}</b>.<br/>This may deactivate the resident's account. Are you sure?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, confirm!',
    });
    if (!result.isConfirmed) return;
  }
  
  updatingStatusFor.value = transactionItem._id;
  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionItem._id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value) throw new Error(error.value.data?.message || 'API error.');

    $toast.fire({ title: data.value?.message || 'Status updated!', icon: 'success' });
    
    // Find item and update its status in the local array for immediate feedback
    const index = transactions.value.findIndex(t => t._id === transactionItem._id);
    if (index !== -1) {
      transactions.value[index].status = newStatus;
    }
  } catch (e) {
    $toast.fire({ title: e.message || 'Failed to update status.', icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }
    return date.toLocaleString('en-US', options);
  } catch (e) {
    return dateString;
  }
};
</script>

<style scoped>
.v-data-table-server {
  font-size: 0.9rem;
}
.text-capitalize {
  text-transform: capitalize;
}
</style>