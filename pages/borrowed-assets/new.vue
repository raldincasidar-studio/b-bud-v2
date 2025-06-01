<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col><h2>Log New Asset Borrowing</h2></v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveTransaction" prepend-icon="mdi-content-save" variant="tonal" :loading="saving" size="large">
          Save Transaction
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-archive-arrow-down-outline" title="Borrowing Details">
      <v-card-text>
        <v-form ref="form">
          <!-- Borrower Search -->
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Name of Borrower <span class="text-red">*</span></label>
              <v-text-field
                v-model="borrowerSearchQuery"
                label="Search Resident Borrower..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined" density="compact"
                clearable
                @click:clear="clearBorrowerSelection"
                :loading="isLoadingBorrowers"
                :rules="[rules.borrowerSelected]"
                :hint="selectedBorrowerName ? `Selected: ${selectedBorrowerName}` : 'Type at least 2 characters to search'"
                persistent-hint
              ></v-text-field>
              <!-- Conditional rendering for search results list -->
              <div v-if="borrowerSearchQuery && borrowerSearchQuery.trim().length >= 2 && !isLoadingBorrowers" class="search-results-container">
                <v-list v-if="borrowerSearchResults.length > 0" density="compact" class="elevation-1">
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
              <v-text-field
                v-model="transaction.borrow_datetime"
                label="Date and Time of Borrowing"
                type="datetime-local"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-text-field>
            </v-col>
          </v-row>
          <!-- Other Fields -->
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="transaction.borrowed_from_personnel"
                label="Borrowed From (Personnel Name)"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="transaction.item_borrowed"
                label="Item Borrowed"
                :items="assetItems"
                :rules="[rules.required]"
                variant="outlined" density="compact" required
              ></v-select>
            </v-col>
          </v-row>
           <v-row>
             <v-col cols="12" md="6">
                <v-select
                    v-model="transaction.status"
                    label="Initial Status"
                    :items="statusOptions"
                    :rules="[rules.required]"
                    variant="outlined" density="compact" required
                ></v-select>
             </v-col>
           </v-row>
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="transaction.notes"
                label="Notes (Optional)"
                variant="outlined" rows="3" auto-grow
              ></v-textarea>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null); // For v-form validation

const transaction = ref({
  borrow_datetime: new Date().toISOString().slice(0, 16),
  borrowed_from_personnel: '',
  item_borrowed: null,
  status: 'Borrowed',
  notes: '',
});
const saving = ref(false);

const borrowerSearchQuery = ref('');
const borrowerSearchResults = ref([]);
const isLoadingBorrowers = ref(false);
const selectedBorrowerId = ref(null);
const selectedBorrowerName = ref(''); // For display in hint

const assetItems = [
  'Chairs', 'Tables', 'Tents', 'Oxygen Tank',
  'Blood Pressure Monitor (BP Monitor)', 'First Aid Kit',
  'Wheelchair', 'Nebulizer', 'Walking Stick'
];
const statusOptions = ['Borrowed', 'Returned', 'Overdue', 'Damaged'];

const rules = {
  required: value => !!value || 'This field is required.',
  borrowerSelected: value => !!selectedBorrowerId.value || 'A borrower must be selected.',
};

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

  // Condition to search (already handled by watcher, but good for direct calls)
  if (trimmedQuery.length < 2) {
    borrowerSearchResults.value = [];
    isLoadingBorrowers.value = false; // Ensure loading is stopped
    return;
  }

  isLoadingBorrowers.value = true;
  borrowerSearchResults.value = []; // Clear previous results before new search

  console.log(`Searching API for: "${trimmedQuery}"`); // DEBUG: Log API call
  try {
    const { data, error } = await useMyFetch('/api/residents/search', {
      query: { q: trimmedQuery },
    });

    if (error.value) {
      console.error('Error searching borrowers:', error.value);
      $toast.fire({ title: 'Error searching borrowers.', icon: 'error' });
      borrowerSearchResults.value = [];
    } else {
      borrowerSearchResults.value = data.value?.residents || [];
      console.log('API Search Results:', borrowerSearchResults.value); // DEBUG: Log results
    }
  } catch (e) {
    console.error("Exception searching borrowers:", e);
    $toast.fire({ title: 'Exception during search.', icon: 'error' });
    borrowerSearchResults.value = [];
  } finally {
    isLoadingBorrowers.value = false;
  }
};

// Define the debounced function directly
const debouncedBorrowerSearch = debounce(searchBorrowersAPI, 600); // Slightly longer debounce

watch(borrowerSearchQuery, (newQueryValue, oldQueryValue) => {
  console.log(`Watcher: borrowerSearchQuery changed from "${oldQueryValue}" to "${newQueryValue}"`); // DEBUG

  // If the query was changed by selecting a borrower, don't re-search immediately
  if (newQueryValue === selectedBorrowerName.value && selectedBorrowerId.value) {
    console.log("Watcher: Query matches selected borrower, not re-searching."); //DEBUG
    borrowerSearchResults.value = []; // Hide results list
    return;
  }
  
  // If the field is cleared, also clear selection and results
  if (!newQueryValue || newQueryValue.trim() === '') {
    console.log("Watcher: Query cleared or empty."); //DEBUG
    borrowerSearchResults.value = [];
    // Optionally clear selected borrower if search is manually cleared
    // if (selectedBorrowerId.value) {
    //   clearBorrowerSelection();
    // }
    return;
  }

  // Only call debounced search if query is long enough
  if (newQueryValue.trim().length >= 2) {
    console.log(`Watcher: Debouncing search for "${newQueryValue}"`); // DEBUG
    debouncedBorrowerSearch(newQueryValue);
  } else {
    borrowerSearchResults.value = []; // Clear results if query becomes too short
  }
});

const selectBorrower = (resident) => {
  selectedBorrowerId.value = resident._id;
  const name = `${resident.first_name || ''} ${resident.middle_name || ''} ${resident.last_name || ''}`.trim();
  selectedBorrowerName.value = name;
  borrowerSearchQuery.value = name; // Update v-model, which will trigger watcher but should be handled
  borrowerSearchResults.value = []; // Hide results list immediately
  console.log('Borrower Selected:', selectedBorrowerName.value, selectedBorrowerId.value); // DEBUG
};

const clearBorrowerSelection = () => {
    // This is called by v-text-field's clearable icon
    borrowerSearchQuery.value = ''; // This will trigger the watcher
    selectedBorrowerId.value = null;
    selectedBorrowerName.value = '';
    borrowerSearchResults.value = [];
    console.log('Borrower Selection Cleared'); // DEBUG
};

async function saveTransaction() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }
  // The rule rules.borrowerSelected already checks selectedBorrowerId.value
  // if (!selectedBorrowerId.value) {
  //   $toast.fire({ title: 'Please select a borrower from the search results.', icon: 'warning' });
  //   return;
  // }

  saving.value = true;
  try {
    const payload = {
      ...transaction.value,
      borrower_resident_id: selectedBorrowerId.value,
      borrower_display_name: selectedBorrowerName.value, // Send the selected name
      borrow_datetime: new Date(transaction.value.borrow_datetime).toISOString(),
    };
    console.log('Saving transaction with payload:', payload); // DEBUG
    const { data, error } = await useMyFetch('/api/borrowed-assets', {
      method: 'POST',
      body: payload,
    });
    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.error || 'Failed to log transaction', icon: 'error' });
    } else {
      $toast.fire({ title: 'Borrowing transaction logged successfully!', icon: 'success' });
      router.push('/borrowed-assets');
    }
  } catch (e) {
    console.error("Exception saving transaction:", e);
    $toast.fire({ title: 'An error occurred.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.search-results-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  /* margin-top: -1px; Remove this if it causes layout issues with hint */
  background-color: white; /* Ensure it's on top */
  z-index: 10; /* Ensure it's on top */
}
.search-results-container { /* New container for better control */
  position: relative; /* For z-index to work if needed, or for absolute positioning of list */
}
.v-label {
    opacity: var(--v-high-emphasis-opacity);
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block;
    margin-bottom: 4px;
}
</style>