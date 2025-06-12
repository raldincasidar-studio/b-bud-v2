<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-2 text-grey-darken-1">Loading Transaction...</p>
    </div>
    <div v-else-if="!transactionData._id">
        <v-alert type="warning" prominent border="start" text="Transaction not found or could not be loaded.">
            <template v-slot:append>
                <v-btn color="grey" variant="text" to="/borrowed-assets">Back to List</v-btn>
            </template>
        </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Transaction Details</h2>
          <p class="text-grey-darken-1">Reference #: {{ transactionId }}</p>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
            <!-- Borrower Display / Search -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Name of Borrower <span v-if="editMode" class="text-red">*</span></label>
                <!-- CORRECTED V-AUTOCOMPLETE -->
                <!-- <v-autocomplete
                  v-if="editMode"
                  readonly
                  v-model:search="borrowerSearchQuery"
                  label="Search to Change Borrower..."
                  :items="borrowerSearchResults"
                  item-title="name"
                  item-value="_id"
                  variant="outlined"
                  :loading="isLoadingBorrowers"
                  :error-messages="v$.borrower_resident_id.$errors.map(e => e.$message)"
                  @blur="v$.borrower_resident_id.$touch"
                  @update:model-value="selectBorrower"
                  no-filter
                >
                    <template v-slot:item="{ props, item }">
                        <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item>
                    </template>
                </v-autocomplete> -->
                <v-text-field :model-value="transactionData.borrower_display_name || 'N/A'" variant="outlined" readonly messages="Borrower can not be changed"></v-text-field>
              </v-col>
              <!-- ... other fields ... -->
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Date & Time Borrowed <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.borrow_datetime" type="datetime-local" :readonly="!editMode" variant="outlined" :error-messages="v$.borrow_datetime.$errors.map(e => e.$message)" @blur="v$.borrow_datetime.$touch"></v-text-field>
              </v-col>
            </v-row>
            
            <!-- Item & Quantity -->
            <v-row>
                <v-col cols="12" md="7">
                    <label class="v-label mb-1">Item Borrowed <span v-if="editMode" class="text-red">*</span></label>
                    <v-autocomplete
                        v-if="editMode"
                        v-model="form.item_borrowed"
                        label="Search for an available item..."
                        :items="inventoryItems"
                        item-title="name"
                        item-value="name"
                        :loading="isLoadingInventory"
                        :error-messages="v$.item_borrowed.$errors.map(e => e.$message)"
                        @blur="v$.item_borrowed.$touch"
                        variant="outlined"
                        @update:model-value="onItemSelect"
                    >
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :title="item.raw.name" :subtitle="`Available: ${item.raw.available} / ${item.raw.total}`"></v-list-item>
                        </template>
                    </v-autocomplete>
                    <v-text-field v-else :model-value="transactionData.item_borrowed" variant="outlined" readonly></v-text-field>
                </v-col>
                <v-col cols="12" md="5">
                    <label class="v-label mb-1">Quantity <span v-if="editMode" class="text-red">*</span></label>
                    <v-text-field v-model.number="form.quantity_borrowed" type="number" :readonly="!editMode" variant="outlined" :error-messages="v$.quantity_borrowed.$errors.map(e => e.$message)" @blur="v$.quantity_borrowed.$touch"></v-text-field>
                </v-col>
            </v-row>
            
            <!-- Status & Return Info (READ-ONLY) -->
            <v-row>
                <v-col cols="12" md="6">
                    <label class="v-label mb-1">Status</label>
                    <v-text-field :model-value="transactionData.status" variant="outlined" readonly>
                        <template v-slot:prepend-inner>
                           <v-chip :color="getStatusColor(transactionData.status)" label size="small">{{ transactionData.status }}</v-chip>
                        </template>
                    </v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                    <label class="v-label mb-1">Date Returned</label>
                    <v-text-field :model-value="formatDateTimeForInput(transactionData.date_returned)" type="datetime-local" variant="outlined" readonly hint="Status is managed via actions on the main list." persistent-hint></v-text-field>
                </v-col>
            </v-row>
            
            <!-- Other Fields -->
            <v-row>
              <v-col cols="12">
                <v-textarea v-model="form.notes" label="Notes" :readonly="!editMode" variant="outlined" rows="3" auto-grow></v-textarea>
              </v-col>
            </v-row>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
        <!-- ... Delete confirmation dialog ... -->
        <v-card>
          <v-card-title class="text-h5">Confirm Deletion</v-card-title>
          <v-card-text>Delete this borrowing transaction? This cannot be undone.</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
            <v-btn color="red-darken-1" variant="text" @click="deleteTransaction" :loading="deleting">Delete</v-btn>
          </v-card-actions>
        </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, minValue } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const transactionId = route.params.id;

// --- STATE ---
const transactionData = ref({});
const form = reactive({
    borrower_resident_id: null, borrower_display_name: '', borrow_datetime: '',
    borrowed_from_personnel: '', item_borrowed: null, quantity_borrowed: 1, notes: ''
});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const inventoryItems = ref([]);
const isLoadingInventory = ref(false);
const borrowerSearchQuery = ref('');
const borrowerSearchResults = ref([]);
const isLoadingBorrowers = ref(false);

// --- VALIDATION (Vuelidate) ---
const rules = {
    borrower_resident_id: { required }, borrow_datetime: { required }, borrowed_from_personnel: { required }, item_borrowed: { required },
    quantity_borrowed: {
        required, minValue: minValue(1),
        isSufficient(value) {
            if (!form.item_borrowed || !value) return true;
            const item = inventoryItems.value.find(i => i.name === form.item_borrowed);
            if (!item) return 'Item not in inventory.';
            const originalQty = transactionData.value.item_borrowed === form.item_borrowed ? (transactionData.value.quantity_borrowed || 0) : 0;
            const totalPermitted = item.available + originalQty;
            if (value > totalPermitted) return `Not enough stock. Max available: ${totalPermitted}.`;
            return true;
        }
    }
};
const v$ = useVuelidate(rules, form);

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => {
    loading.value = true;
    await Promise.all([ fetchTransaction(), fetchInventory() ]);
    loading.value = false;
});

async function fetchTransaction() {
  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`);
    if (error.value || !data.value?.transaction) throw new Error('Transaction not found.');
    transactionData.value = { ...data.value.transaction };
    resetForm();
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    router.push('/borrowed-assets');
  }
}

async function fetchInventory() {
  isLoadingInventory.value = true;
  try {
    const { data, error } = await useMyFetch('/api/assets/inventory-status');
    if (error.value) throw new Error('Could not load asset inventory.');
    inventoryItems.value = data.value?.inventory || [];
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { isLoadingInventory.value = false; }
}

// --- FORM & UI LOGIC ---
function resetForm() {
    Object.assign(form, {
        borrower_resident_id: transactionData.value.borrower_resident_id,
        borrower_display_name: transactionData.value.borrower_display_name,
        borrow_datetime: formatDateTimeForInput(transactionData.value.borrow_datetime),
        borrowed_from_personnel: transactionData.value.borrowed_from_personnel,
        item_borrowed: transactionData.value.item_borrowed,
        quantity_borrowed: transactionData.value.quantity_borrowed || 1,
        notes: transactionData.value.notes || ''
    });
    borrowerSearchQuery.value = transactionData.value.borrower_display_name || '';
    v$.value.$reset();
}

const toggleEditMode = (enable) => { editMode.value = enable; if (!enable) resetForm(); };
const cancelEdit = () => toggleEditMode(false);
const onItemSelect = () => { form.quantity_borrowed = 1; v$.value.quantity_borrowed.$reset(); };

// --- BORROWER SEARCH LOGIC ---
const debouncedBorrowerSearch = debounce(async (query) => {
    isLoadingBorrowers.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error('Error searching borrowers.');
        // The data returned from the API must be mapped to what the v-autocomplete expects
        borrowerSearchResults.value = data.value?.residents.map(r => ({
            _id: r._id,
            name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email
        })) || [];
    } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { isLoadingBorrowers.value = false; }
}, 500);

watch(borrowerSearchQuery, (newQuery) => {
    if (newQuery === form.borrower_display_name) {
        borrowerSearchResults.value = [];
        return;
    }
    if (form.borrower_resident_id) {
        form.borrower_resident_id = null;
    }
    if (!newQuery || newQuery.trim().length < 2) { 
        borrowerSearchResults.value = []; 
        return; 
    }
    debouncedBorrowerSearch(newQuery);
});

const selectBorrower = (resident) => {
  console.log('select borrower: ', resident);
  if (!resident) return;
  form.borrower_resident_id = resident;
  form.borrower_display_name = resident?.name;
  borrowerSearchQuery.value = resident?.name; // This is key to stop the watcher
  borrowerSearchResults.value = [];
  console.log(form.borrower_resident_id);
};

// --- SAVE & DELETE ---
async function saveChanges() {
  console.log(form.borrower_resident_id);
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    const payload = { ...form, borrow_datetime: new Date(form.borrow_datetime).toISOString() };
    const { error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'PUT', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update transaction.');
    $toast.fire({ title: 'Transaction updated successfully!', icon: 'success' });
    await fetchTransaction();
    toggleEditMode(false);
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteTransaction() {
    deleting.value = true;
    try {
        const { error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'DELETE' });
        if (error.value) throw new Error('Failed to delete transaction.');
        $toast.fire({ title: 'Transaction deleted!', icon: 'success' });
        router.push('/borrowed-assets');
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        deleting.value = false;
        confirmDeleteDialog.value = false;
    }
}

// --- HELPER FUNCTIONS ---
function debounce(func, delay) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
function formatDateTimeForInput(isoString) { if (!isoString) return ''; return new Date(isoString).toISOString().slice(0, 16); }
const getStatusColor = (status) => ({ 'Borrowed': 'orange-darken-1', 'Returned': 'green-darken-1', 'Overdue': 'red-darken-2', 'Lost': 'error', 'Damaged': 'warning' }[status] || 'grey');
</script>

<style scoped>
.v-label {
    opacity: 1;
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
}
</style>