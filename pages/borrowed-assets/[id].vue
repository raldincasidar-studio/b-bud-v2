<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-2">Loading transaction...</p>
    </div>
    <div v-else-if="!transactionData._id && !errorLoading">
        <v-alert type="warning" prominent border="start">Transaction not found.
            <v-btn color="primary" variant="text" to="/borrowed-assets" class="ml-2">Back to List</v-btn>
        </v-alert>
    </div>
    <div v-else-if="errorLoading">
        <v-alert type="error" prominent border="start">Error loading transaction.
             <v-btn color="primary" variant="text" @click="fetchTransaction" class="ml-2">Retry</v-btn>
        </v-alert>
    </div>

    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
            <h2 class="text-truncate" :title="`Transaction: ${transactionData.item_borrowed} by ${transactionData.borrower_display_name}`">
                Transaction Details
            </h2>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="red" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card prepend-icon="mdi-clipboard-text-clock-outline" :title="editMode ? 'Edit Borrowing Transaction' : 'View Borrowing Transaction'">
        <v-card-text>
          <v-form ref="form">
            <!-- Borrower Display / Search -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Name of Borrower <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field
                  v-if="editMode"
                  v-model="borrowerSearchQuery"
                  label="Search to Change Borrower..."
                  prepend-inner-icon="mdi-account-search-outline"
                  variant="outlined" density="compact"
                  clearable
                  @click:clear="clearBorrowerSelection"
                  :loading="isLoadingBorrowers"
                  :rules="[rules.borrowerSelected]"
                  :hint="selectedBorrowerName ? `Selected: ${selectedBorrowerName}` : 'Type at least 2 characters to search'"
                  persistent-hint
                ></v-text-field>
                <v-text-field
                    v-else
                    :model-value="editableTransaction.borrower_display_name || 'N/A'"
                    label="Name of Borrower"
                    variant="outlined" density="compact" readonly
                ></v-text-field>
                 <div v-if="editMode && borrowerSearchQuery && borrowerSearchQuery.trim().length >= 2 && !isLoadingBorrowers" class="search-results-container">
                    <v-list v-if="borrowerSearchResults.length > 0" density="compact" class="elevation-1 search-results-list">
                        <v-list-item
                            v-for="resident in borrowerSearchResults"
                            :key="resident._id"
                            @click="selectBorrower(resident)"
                            ripple
                        >
                            <v-list-item-title>{{ `${resident.first_name} ${resident.middle_name || ''} ${resident.last_name}`.trim() }}</v-list-item-title>
                            <v-list-item-subtitle>{{ resident.email || 'No email' }}</v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                     <p v-else-if="!isLoadingBorrowers && borrowerSearchQuery.trim().length >= 2" class="text-grey pa-3 text-center">
                        No residents found matching "{{ borrowerSearchQuery }}".
                    </p>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableTransaction.borrow_datetime" label="Date & Time Borrowed" type="datetime-local" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>
            <!-- Other Transaction Fields -->
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableTransaction.borrowed_from_personnel" label="Borrowed From (Personnel)" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-select v-model="editableTransaction.item_borrowed" label="Item Borrowed" :items="assetItems" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-select>
              </v-col>
            </v-row>
            <v-row>
                <v-col cols="12" md="6">
                    <v-select v-model="editableTransaction.status" label="Status" :items="statusOptions" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-select>
                </v-col>
                 <v-col cols="12" md="6" v-if="editableTransaction.status === 'Returned' || editableTransaction.status === 'Damaged'">
                    <v-text-field v-model="editableTransaction.date_returned" label="Date Returned" type="datetime-local" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
                </v-col>
            </v-row>
            <v-row v-if="editableTransaction.status === 'Returned' || editableTransaction.status === 'Damaged'">
                <v-col cols="12">
                    <v-textarea v-model="editableTransaction.return_condition" label="Return Condition (Optional)" :readonly="!editMode" variant="outlined" rows="3" auto-grow></v-textarea>
                </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-textarea v-model="editableTransaction.notes" label="Notes (Optional)" :readonly="!editMode" variant="outlined" rows="3" auto-grow></v-textarea>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
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
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast, $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const transactionId = route.params.id;
const form = ref(null); // For v-form validation

const transactionData = ref({}); // Original data from API for display
const editableTransaction = ref({ // Data for the form in edit mode
    borrower_resident_id: null,
    borrower_display_name: '' // Will be populated from transactionData or new selection
});
const loading = ref(true);
const errorLoading = ref(false);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

// State for borrower search in edit mode
const borrowerSearchQuery = ref(''); // v-model for the search input
const borrowerSearchResults = ref([]);
const isLoadingBorrowers = ref(false);
// selectedBorrowerId and selectedBorrowerName will be part of editableTransaction.borrower_resident_id and editableTransaction.borrower_display_name

const assetItems = ['Chairs', 'Tables', 'Tents', 'Oxygen Tank', 'Blood Pressure Monitor (BP Monitor)', 'First Aid Kit', 'Wheelchair', 'Nebulizer', 'Walking Stick'];
const statusOptions = ['Borrowed', 'Returned', 'Overdue', 'Damaged'];

const rules = { 
    required: value => !!value || 'This field is required.',
    // Rule for borrower selection is now implicit as editableTransaction.borrower_resident_id must be set
    borrowerSelected: value => !!editableTransaction.value.borrower_resident_id || 'A borrower must be selected.',
};

onMounted(async () => { await fetchTransaction(); });

function formatDateTimeForInput(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } catch (e) { return isoString; }
}

async function fetchTransaction() {
  loading.value = true; errorLoading.value = false;
  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`);
    if (error.value || !data.value?.transaction) {
      errorLoading.value = true; transactionData.value = {}; console.error('Fetch error:', error.value);
    } else {
      transactionData.value = { ...data.value.transaction };
      // The API for GET /api/borrowed-assets/:id should ideally return borrower_display_name or enough details
      // If it only returns borrower_resident_id, you might need another fetch here for the name if not already handled by API $lookup.
      // For now, assuming API returns borrower_display_name.
      resetEditableData(); // Initialize form with fetched data
    }
  } catch (e) { errorLoading.value = true; console.error("Exception fetching transaction:", e); }
  finally { loading.value = false; }
}

function resetEditableData() {
  editableTransaction.value = JSON.parse(JSON.stringify(transactionData.value));
  if (editableTransaction.value.borrow_datetime) {
    editableTransaction.value.borrow_datetime = formatDateTimeForInput(editableTransaction.value.borrow_datetime);
  }
  if (editableTransaction.value.date_returned) {
    editableTransaction.value.date_returned = formatDateTimeForInput(editableTransaction.value.date_returned);
  } else {
     editableTransaction.value.date_returned = ''; // For datetime-local input
  }
  // Initialize borrower search query with the current borrower's display name for edit mode
  borrowerSearchQuery.value = editableTransaction.value.borrower_display_name || '';
  borrowerSearchResults.value = []; // Clear search results
}

function toggleEditMode(enable) { 
  editMode.value = enable; 
  if (enable) {
    resetEditableData(); // When entering edit mode, set form to current saved state
  }
}
function cancelEdit() { 
  toggleEditMode(false); 
  resetEditableData(); // Revert any changes back to original saved state
}

// Debounce utility
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

const searchBorrowersAPI = async (searchQueryString) => {
  const trimmedQuery = typeof searchQueryString === 'string' ? searchQueryString.trim() : '';
  if (trimmedQuery.length < 2) {
    borrowerSearchResults.value = [];
    isLoadingBorrowers.value = false;
    return;
  }
  isLoadingBorrowers.value = true;
  borrowerSearchResults.value = [];
  try {
    const { data, error } = await useMyFetch('/api/residents/search', { // Using general resident search
      query: { q: trimmedQuery },
    });
    if (error.value) {
      console.error('Error searching borrowers:', error.value);
    } else {
      borrowerSearchResults.value = data.value?.residents || [];
    }
  } catch (e) { console.error("Exception searching borrowers:", e); }
  finally { isLoadingBorrowers.value = false; }
};
const debouncedBorrowerSearch = debounce(searchBorrowersAPI, 600);

watch(borrowerSearchQuery, (newQueryValue, oldQueryValue) => {
    // Prevent re-search if query was set by selecting a borrower
    if (newQueryValue === editableTransaction.value.borrower_display_name && editableTransaction.value.borrower_resident_id) {
        // If user deletes selected name and starts typing, then allow search
        if(newQueryValue !== oldQueryValue && oldQueryValue === editableTransaction.value.borrower_display_name){
             // This condition means user actively changed the pre-filled name
        } else {
            borrowerSearchResults.value = []; // Hide results if query matches current selected
            return;
        }
    }
    if (!newQueryValue || typeof newQueryValue !== 'string' || newQueryValue.trim().length < 2) {
        borrowerSearchResults.value = [];
        return;
    }
    debouncedBorrowerSearch(newQueryValue);
});

const selectBorrower = (resident) => {
  editableTransaction.value.borrower_resident_id = resident._id;
  const name = `${resident.first_name || ''} ${resident.middle_name || ''} ${resident.last_name || ''}`.trim();
  editableTransaction.value.borrower_display_name = name;
  borrowerSearchQuery.value = name; // Update v-model of the text field
  borrowerSearchResults.value = []; // Hide results list
};

const clearBorrowerSelection = () => {
    borrowerSearchQuery.value = ''; // This will trigger the watcher
    editableTransaction.value.borrower_resident_id = null;
    editableTransaction.value.borrower_display_name = '';
    borrowerSearchResults.value = [];
};

async function saveChanges() {
  const { valid } = await form.value.validate();
  if (!valid) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  if (!editableTransaction.value.borrower_resident_id) { 
    $toast.fire({ title: 'A borrower must be selected.', icon: 'warning' });
    return;
  }

  saving.value = true;
  try {
    const payload = { ...editableTransaction.value };
    // borrower_resident_id and borrower_display_name are already in editableTransaction

    if (payload.borrow_datetime) payload.borrow_datetime = new Date(payload.borrow_datetime).toISOString();
    if (payload.date_returned) payload.date_returned = new Date(payload.date_returned).toISOString();
    else if (payload.status !== 'Returned' && payload.status !== 'Damaged') payload.date_returned = null;

    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'PUT', body: payload });
    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.error || 'Failed to update transaction.', icon: 'error' });
    } else {
      $toast.fire({ title: 'Transaction updated successfully!', icon: 'success' });
      transactionData.value = { ...data.value.transaction }; // Update main display data
      resetEditableData(); // Reset form to reflect saved state
      toggleEditMode(false);
    }
  } catch (e) { console.error("Save exception:", e); $toast.fire({ title: 'An error occurred while saving.', icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteTransaction() {
  // const { isConfirmed } = await $swal({
  //   title: `Delete Transaction?`, text: 'This cannot be reversed!',
  //   showCancelButton: true, confirmButtonText: 'Yes, delete it!', cancelButtonText: 'Cancel',
  // });
  // if (!isConfirmed) return;

  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'DELETE' });
    if (error.value) { $toast.fire({ title: 'Failed to delete.', icon: 'error' }); }
    else { $toast.fire({ title: 'Deleted!', icon: 'success' }); router.push('/borrowed-assets'); }
  } catch (e) { console.error("Delete exception:", e); $toast.fire({ title: 'Error.', icon: 'error' }); }
  finally { deleting.value = false; confirmDeleteDialog.value = false; }
}

watch(() => editableTransaction.value.status, (newStatus) => {
    if (editMode.value && (newStatus !== 'Returned' && newStatus !== 'Damaged')) {
        editableTransaction.value.date_returned = '';
        editableTransaction.value.return_condition = '';
    } else if (editMode.value && (newStatus === 'Returned' || newStatus === 'Damaged') && !editableTransaction.value.date_returned) {
        editableTransaction.value.date_returned = formatDateTimeForInput(new Date().toISOString());
    }
});
</script>

<style scoped>
.search-results-container {
  position: relative; 
}
.search-results-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  background-color: white;
  z-index: 100; /* Higher z-index */
  position: absolute;
  width: 100%; 
  margin-top: -2px; 
}
.v-label {
    opacity: var(--v-high-emphasis-opacity);
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block;
    margin-bottom: 4px;
}
</style>