<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">New Asset Borrowing Request</h2>
        <p class="text-grey-darken-1">Fill out the form to request an asset from the barangay.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          color="primary"
          @click="saveTransaction"
          prepend-icon="mdi-send-check-outline"
          variant="flat"
          :loading="saving"
          size="large"
          rounded="lg"
        >
          Submit Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-archive-arrow-down-outline" title="Borrowing Details" flat border>
      <v-card-text class="pt-4">
        <v-form ref="form">
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Name of Borrower (Resident) <span class="text-red">*</span></label>
              <v-autocomplete
                v-model="selectedBorrower"
                v-model:search="borrowerSearchQuery"
                :items="borrowerSearchResults"
                :loading="isLoadingBorrowers"
                item-title="fullName"
                item-value="_id"
                label="Search Resident from Population..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined"
                
                return-object
                no-filter
                clearable
                
                :rules="[rules.requiredObject, rules.borrowerIsActive]"
                
                hint="Type at least 2 characters to search for a registered resident"
                persistent-hint
              >
                <template v-slot:no-data>
                  <v-list-item>
                    <v-list-item-title>
                      No residents found matching "<strong>{{ borrowerSearchQuery }}</strong>".
                    </v-list-item-title>
                  </v-list-item>
                </template>

                <!-- UPDATED TEMPLATE: Now checks both 'status' and 'account_status' -->
                 <template v-slot:item="{ props, item }">
                  <v-list-item
                    v-bind="props"
                    :title="item.raw.fullName"
                    :subtitle="item.raw.address_street"
                    :disabled="item.raw.status !== 'Approved' || item.raw.account_status !== 'Active'"
                  >
                    <template v-slot:append>
                      <v-chip
                        v-if="item.raw.status === 'Pending'"
                        color="orange-darken-1" variant="tonal" size="small" label
                      >
                        Pending
                      </v-chip>
                      <v-chip
                        v-else-if="item.raw.status === 'Declined'"
                        color="red-darken-2" variant="tonal" size="small" label
                      >
                        Declined
                      </v-chip>
                      <v-chip
                        v-else-if="item.raw.status === 'Deactivated'"
                        color="grey-darken-1" variant="tonal" size="small" label
                      >
                        Deactivated
                      </v-chip>
                      <v-chip
                        v-else-if="item.raw.account_status !== 'Active'"
                        color="warning" variant="tonal" size="small" label
                      >
                        On Hold
                      </v-chip>
                    </template>
                  </v-list-item>
                </template>

              </v-autocomplete>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Date and Time of Borrowing <span class="text-red">*</span></label>
              <v-text-field
                v-model="transaction.borrow_datetime"
                type="datetime-local"
                :rules="[rules.required]"
                variant="outlined"
                
                required
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="7">
              <label class="v-label mb-1">Item to Borrow <span class="text-red">*</span></label>
              <v-autocomplete
                v-model="transaction.item_borrowed"
                label="Search for an available item..."
                :items="inventoryItems"
                item-title="name"
                item-value="name"
                :loading="isLoadingInventory"
                :rules="[rules.required, rules.itemIsAvailable]"
                variant="outlined"
                
                required
                @update:model-value="onItemSelect"
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item
                    v-bind="props"
                    :subtitle="`Available: ${item.raw.available}`"
                    :disabled="item.raw.available <= 0"
                  >
                    <template v-slot:append>
                      <v-chip v-if="item.raw.available <= 0" color="red-darken-2" size="x-small" label text="Unavailable"></v-chip>
                      <v-chip v-else-if="item.raw.available < 5" color="orange-darken-1" size="x-small" label text="Low Stock"></v-chip>
                    </template>
                  </v-list-item>
                </template>
              </v-autocomplete>
            </v-col>
            <v-col cols="12" md="5">
              <label class="v-label mb-1">Quantity <span class="text-red">*</span></label>
              <v-text-field
                v-model.number="transaction.quantity_borrowed"
                type="number"
                variant="outlined"
                
                required
                :disabled="!transaction.item_borrowed"
                :rules="[rules.required, rules.quantityIsValid]"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Expected Return Date <span class="text-red">*</span></label>
              <v-text-field
                v-model="transaction.expected_return_date"
                type="date"
                :rules="[rules.required, rules.futureDate]"
                variant="outlined"
                
                required
                :min="new Date().toISOString().split('T')[0]"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Request Processed By (Personnel)</label>
              <v-text-field
                v-model="transaction.borrowed_from_personnel"
                variant="outlined"
                
                readonly
                hint="This is automatically filled with the logged-in user's name."
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="transaction.notes"
                label="Notes / Reason for Borrowing (Optional)"
                placeholder="e.g., 'For a community event', 'Personal medical need', etc."
                variant="outlined"
                rows="3"
                auto-grow
              ></v-textarea>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp, useCookie } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null);
const saving = ref(false);

const transaction = reactive({
  borrow_datetime: new Date().toISOString().slice(0, 16),
  borrowed_from_personnel: '',
  item_borrowed: null,
  quantity_borrowed: 0,
  expected_return_date: '',
  notes: '',
});

// Resident search state
const borrowerSearchQuery = ref('');
const borrowerSearchResults = ref([]);
const isLoadingBorrowers = ref(false);
const selectedBorrower = ref(null);

// Inventory state
const inventoryItems = ref([]);
const isLoadingInventory = ref(true);

// --- Simple Debounce Utility ---
const useDebounce = (fn, delay = 500) => {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const rules = {
  required: value => !!value || 'This field is required.',
  requiredObject: value => (!!value && typeof value === 'object' && value !== null) || 'You must select a borrower.',
  
  // UPDATED: Check both 'status' and 'account_status'
  borrowerIsActive: value => {
    if (!value) return true; // Let the 'requiredObject' rule handle empty selections.
    
    // Detailed message based on resident's status
    if (value.status === 'Pending') return `Resident account is pending approval and cannot borrow new items.`;
    if (value.status === 'Declined') return `Resident account has been declined and cannot borrow new items.`;
    if (value.status === 'Deactivated') return `Resident account has been permanently deactivated and cannot borrow new items.`;
    if (value.account_status !== 'Active') return `This resident's account is On Hold and cannot borrow new items.`;
    
    return true; // If all checks pass, the borrower is active and can proceed
  },
  
  futureDate: value => new Date(value) >= new Date(new Date().toDateString()) || 'Date cannot be in the past.',
  itemIsAvailable: value => {
    if (!value) return true;
    const item = inventoryItems.value.find(i => i.name === value);
    return (item && item.available > 0) || 'This item is currently unavailable.';
  },
  quantityIsValid: value => {
    if (!transaction.item_borrowed || !value) return true;
    if (value <= 0) return 'Quantity must be greater than 0.';
    const item = inventoryItems.value.find(i => i.name === transaction.item_borrowed);
    if (!item) return true;
    return value <= item.available || `Not enough stock. Only ${item.available} available.`;
  },
};

const searchBorrowers = useDebounce(async (query) => {
  if (!query || query.trim().length < 2) {
    borrowerSearchResults.value = [];
    return;
  }
  isLoadingBorrowers.value = true;
  try {
    const { data } = await useMyFetch(`/api/residents/search?q=${query}`);
    if (data.value?.residents) {
      borrowerSearchResults.value = data.value.residents.map(r => ({
        ...r,
        fullName: `${r.first_name} ${r.middle_name || ''} ${r.last_name}`.replace(/\s+/g, ' ').trim(),
        status: r.status, // ADDED: Project 'status' here
      }));
    }
  } catch(e) {
    console.error("Error searching for residents:", e);
    $toast.fire({ title: 'Could not search for residents.', icon: 'error' });
  } finally {
    isLoadingBorrowers.value = false;
  }
});

watch(borrowerSearchQuery, (query) => {
  if (selectedBorrower.value && query === selectedBorrower.value.fullName) return;
  searchBorrowers(query);
});

async function fetchInventory() {
  isLoadingInventory.value = true;
  try {
    const { data, error } = await useMyFetch('/api/assets', { 
      query: { itemsPerPage: 1000 }
    });

    if (error.value) {
      throw new Error('Failed to load asset inventory.');
    }

    inventoryItems.value = data.value?.assets || [];

  } catch(e) {
    console.error("Error fetching inventory:", e);
    $toast.fire({ title: e.message || 'Could not load asset inventory.', icon: 'error' });
  } finally {
    isLoadingInventory.value = false;
  }
}

onMounted(() => {
  fetchInventory();
  const userData = useCookie('userData');
  if (userData.value) {
    transaction.borrowed_from_personnel = userData.value.name;
  }
});

const onItemSelect = () => {
  transaction.quantity_borrowed = 1;
};

async function saveTransaction() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the errors in the form.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...transaction,
      borrower_resident_id: selectedBorrower.value._id,
      borrower_display_name: selectedBorrower.value.fullName,
      borrow_datetime: new Date(transaction.borrow_datetime).toISOString(),
      expected_return_date: new Date(transaction.expected_return_date).toISOString(),
    };

    const { data, error } = await useMyFetch('/api/borrowed-assets', {
      method: 'POST',
      body: payload,
    });

    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to submit request', icon: 'error' });
    } else {
      $toast.fire({ title: 'Request submitted successfully!', icon: 'success' });
      router.push('/borrowed-assets');
    }
  } catch (e) {
    console.error("Exception saving transaction:", e);
    $toast.fire({ title: 'An unexpected error occurred.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.v-label {
  opacity: var(--v-high-emphasis-opacity);
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}
</style>