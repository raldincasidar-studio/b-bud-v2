<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4 text-grey-darken-1">Loading Transaction Details...</p>
    </div>
    <v-alert v-else-if="!transactionData._id" type="error" prominent border="start">
      <template v-slot:title>Transaction Not Found</template>
      The transaction you are looking for does not exist or could not be loaded. It may have been deleted.
      <template v-slot:append>
        <v-btn color="white" variant="outlined" to="/borrowed-assets" class="mt-2">Back to List</v-btn>
      </template>
    </v-alert>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Manage Transaction</h2>
          <p class="text-grey-darken-1">Ref #: {{ transactionId }}</p>
        </v-col>
        <v-col class="text-right">
            <!-- ADDED: Status Chip -->
            <v-chip :color="getStatusColor(transactionData.status)" label size="large" class="font-weight-bold mr-4">{{ transactionData.status }}</v-chip>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="isSaving" variant="flat" rounded="lg">Save</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" variant="text" rounded="lg">Cancel</v-btn>
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" rounded="lg">Delete</v-btn>
        </v-col>
      </v-row>

      <!-- ✨ STATUS TRACKER START ✨ -->
      <div class="status-tracker-container my-12">
        <div class="progress-bar-container">
            <div class="progress-bar-bg"></div>
            <div
                class="progress-bar-fg"
                :class="isFailureState ? 'bg-error' : 'bg-primary'"
                :style="{ width: progressWidth }"
            ></div>
        </div>
        <div class="steps-container">
            <div v-for="(step, index) in trackerSteps" :key="step.name" class="step-item">
                <div
                    class="step-circle"
                    :class="{
                        'completed': !isFailureState && index < activeStepIndex,
                        'current': !isFailureState && index === activeStepIndex,
                        'declined': isFailureState && index < activeStepIndex, // Use 'declined' for steps before failure point
                        'failure-point': isFailureState && index === activeStepIndex
                    }"
                >
                    <v-icon size="large">
                        {{ getStepIcon(index, step.icon) }}
                    </v-icon>
                </div>
                <div
                    class="step-label mt-3"
                    :class="{ 'font-weight-bold text-primary': !isFailureState && index === activeStepIndex }"
                >
                    {{ step.name }}
                </div>
            </div>
        </div>
      </div>
      <!-- ✨ STATUS TRACKER END ✨ -->

      <v-row>
        <!-- Left Column: Transaction Details -->
        <v-col cols="12" md="7">
          <v-card flat border prepend-icon="mdi-clipboard-list-outline" title="Transaction Information">
            <v-card-text class="pt-4">
              <v-form ref="form">
                <label class="v-label">Borrower</label>
                <v-text-field :model-value="transactionData.borrower_display_name || 'N/A'" readonly variant="outlined"  class="mb-2" prepend-inner-icon="mdi-account"></v-text-field>

                <label class="v-label">Item Borrowed</label>
                <v-text-field v-model="form.item_borrowed" :readonly="!editMode" variant="outlined"  class="mb-2" prepend-inner-icon="mdi-cube-outline"></v-text-field>

                <label class="v-label">Quantity</label>
                <v-text-field v-model.number="form.quantity_borrowed" :readonly="!editMode" type="number" variant="outlined"  class="mb-2" prepend-inner-icon="mdi-counter"></v-text-field>

                <label class="v-label">Date Borrowed</label>
                <v-text-field v-model="form.borrow_datetime" :readonly="true" type="datetime-local" variant="outlined"  class="mb-2" prepend-inner-icon="mdi-calendar-arrow-right"></v-text-field>

                <label class="v-label">Expected Return Date</label>
                <v-text-field v-model="form.expected_return_date" :readonly="!editMode" type="date" variant="outlined"  class="mb-2" prepend-inner-icon="mdi-calendar-arrow-left"></v-text-field>

                <label class="v-label">Notes / Reason for Borrowing</label>
                <v-textarea v-model="form.notes" :readonly="!editMode" variant="outlined" rows="4" auto-grow prepend-inner-icon="mdi-note-text-outline"></v-textarea>
              </v-form>

              <!-- ✨ NEW/IMPROVED: Alert for displaying the rejection reason -->
              <v-alert
                v-if="transactionData.status === 'Rejected' && transactionData.notes"
                type="error"
                variant="tonal"
                border="start"
                class="mt-4"
                icon="mdi-information-outline"
                density="compact"
              >
                <template v-slot:title><strong class="text-error">Reason for Rejection</strong></template>
                <pre class="text-body-2" style="white-space: pre-wrap; font-family: inherit;">{{ transactionData.notes }}</pre>
              </v-alert>

            </v-card-text>
          </v-card>
        </v-col>

        <!-- Right Column: Status & Return Management -->
        <v-col cols="12" md="5">
            <v-card flat border>
                 <v-list-item class="pa-4" :prepend-icon="getStatusIcon(transactionData.status)" :base-color="getStatusColor(transactionData.status)">
                    <v-list-item-title class="text-h6">
                        {{ transactionData.status }}
                    </v-list-item-title>
                    <v-list-item-subtitle>Current Status</v-list-item-subtitle>
                </v-list-item>
                <v-divider></v-divider>
                
                <!-- Status Management for Pending/Processing -->
                <div v-if="['Pending', 'Processing'].includes(transactionData.status)">
                    <v-card-text>
                        <p class="text-body-2 mb-4">Review the request details and move it to the next stage.</p>
                        <div class="d-flex flex-column ga-2">
                            <v-btn v-if="transactionData.status === 'Pending'" @click="updateStatus('Processing')" color="blue" variant="tonal" block prepend-icon="mdi-cogs">Start Processing</v-btn>
                            <v-btn v-if="transactionData.status === 'Processing'" @click="updateStatus('Approved')" color="success" variant="tonal" block prepend-icon="mdi-check-circle">Approve & Release Item</v-btn>
                            <v-btn @click="updateStatus('Rejected', true)" color="error" variant="tonal" block prepend-icon="mdi-cancel">Reject Request</v-btn>
                        </div>
                    </v-card-text>
                </div>

                <!-- Return Management -->
                <div v-if="['Approved', 'Overdue', 'Returned'].includes(transactionData.status)">
                    <v-card-text>
                        <p class="text-body-2 mb-4">Once the resident returns the item, upload proof and add notes on its condition.</p>
                        <v-file-input v-model="returnForm.proofImage" label="Upload Return Proof (Photo)" variant="outlined"  prepend-icon="mdi-camera" accept="image/*" :rules="[fileSizeRule]"></v-file-input>
                        <v-textarea v-model="returnForm.conditionNotes" label="Notes on Return Condition" placeholder="e.g., 'Returned in good condition'" variant="outlined" rows="3"></v-textarea>
                    </v-card-text>
                    <v-card-actions class="pa-4 flex-wrap">
                        <v-btn color="success" variant="flat" v-if="transactionData.status === 'Approved' || transactionData.status === 'Overdue'" @click="processReturn" :loading="isReturning" prepend-icon="mdi-keyboard-return" size="large">Mark as Returned</v-btn>
                        <v-btn v-if="transactionData.status === 'Approved' || transactionData.status === 'Overdue'" color="error" variant="flat" @click="updateStatus('Damaged')" prepend-icon="mdi-alert-octagon-outline" size="large">Mark as Damaged</v-btn>
                        <v-btn v-if="transactionData.status === 'Approved' || transactionData.status === 'Overdue'" color="error" variant="flat" @click="updateStatus('Lost')" prepend-icon="mdi-delete-forever" size="large">Mark as Lost</v-btn>
                    </v-card-actions>
                </div>

                <!-- Display Return Info -->
                <div v-if="transactionData.status === 'Returned'">
                    <v-card-text>
                        <v-list lines="two" >
                            <v-list-item title="Actual Return Date" :subtitle="formatDateTime(transactionData.date_returned)"></v-list-item>
                            <v-divider inset></v-divider>
                            <v-list-item title="Return Condition Notes" :subtitle="transactionData.return_condition_notes || 'No notes provided.'"></v-list-item>
                        </v-list>
                        <div v-if="transactionData.return_proof_image_url" class="pa-2 mt-2">
                            <p class="text-subtitle-2 mb-2">Return Proof:</p>
                            <v-img :src="transactionData.return_proof_image_url" max-height="300" class="elevation-2 rounded-lg border cursor-pointer" @click="openGallery('return_proof')"></v-img>
                        </div>
                        <v-alert v-else type="info" variant="tonal" class="mt-2" text="No return proof was uploaded."></v-alert>
                    </v-card-text>
                </div>
                
                <!-- Problem Management (Lost/Damaged) -->
                 <div v-else-if="['Lost', 'Damaged'].includes(transactionData.status)">
                    <v-card-text>
                        <v-alert type="warning" variant="tonal" class="mb-4">The resident's account has been temporarily deactivated due to this issue.</v-alert>
                        <p class="text-body-2 mb-4">Once the issue is settled (e.g., item is paid for or replaced), mark this transaction as resolved to reactivate the resident's account.</p>
                    </v-card-text>
                    <v-card-actions class="pa-4">
                        <v-spacer></v-spacer>
                        <v-btn color="teal" variant="flat" @click="updateStatus('Resolved', true)" prepend-icon="mdi-handshake-outline" size="large">Mark as Resolved</v-btn>
                    </v-card-actions>
                </div>

                <!-- ✨ CORRECTED: Other statuses (Resolved, Rejected) -->
                <div v-if="['Resolved', 'Rejected'].includes(transactionData.status)">
                     <v-card-text>
                        <v-alert :type="transactionData.status === 'Resolved' ? 'success' : 'error'" variant="tonal">
                            This transaction is considered closed. No further actions are required.
                        </v-alert>
                    </v-card-text>
                </div>
            </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Image Gallery Dialog -->
    <v-dialog v-model="galleryDialog" max-width="1000px" scrollable>
        <v-card class="d-flex flex-column">
          <v-toolbar color="primary" density="compact">
            <v-toolbar-title class="text-h6">{{ imageGallerySource[currentGalleryIndex]?.title }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" @click="galleryDialog = false"></v-btn>
          </v-toolbar>
          <v-card-text class="pa-0 flex-grow-1 d-flex align-center justify-center" style="background-color: rgba(0,0,0,0.85);">
            <v-carousel v-model="currentGalleryIndex" height="100%" hide-delimiters :show-arrows="imageGallerySource.length > 1 ? 'hover' : false" style="min-height: 50vh;">
              <v-carousel-item v-for="(item, i) in imageGallerySource" :key="i">
                <v-img :src="item.src" contain max-height="80vh"></v-img>
              </v-carousel-item>
            </v-carousel>
          </v-card-text>
        </v-card>
    </v-dialog>

    <!-- Delete confirmation dialog -->
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
        <v-card>
          <v-card-title class="text-h5">Confirm Deletion</v-card-title>
          <v-card-text>Are you sure you want to permanently delete this transaction? This action cannot be undone.</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
            <v-btn color="error" variant="tonal" @click="deleteTransaction" :loading="isDeleting">Delete</v-btn>
          </v-card-actions>
        </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import Swal from 'sweetalert2';

// NOTE: This STATUS_CONFIG is already correctly defined and used for the chip and list-item.
// The tracker steps will use their own icons, primarily derived from here.
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

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const transactionId = route.params.id;

// --- STATE ---
const transactionData = ref({});
const form = reactive({ item_borrowed: '', quantity_borrowed: 1, borrow_datetime: '', expected_return_date: '', notes: '' });
const returnForm = reactive({ proofImage: null, conditionNotes: '' });

const loading = ref(true);
const editMode = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isReturning = ref(false);
const confirmDeleteDialog = ref(false);

const galleryDialog = ref(false);
const currentGalleryIndex = ref(0);

const imageGallerySource = computed(() => {
  const items = [];
  if (transactionData.value.return_proof_image_url) {
    items.push({ 
      id: 'return_proof', 
      src: transactionData.value.return_proof_image_url, 
      title: 'Return Proof' 
    });
  }
  return items;
});

function openGallery(id) {
  const foundIndex = imageGallerySource.value.findIndex(item => item.id === id);
  if (foundIndex > -1) {
    currentGalleryIndex.value = foundIndex;
    galleryDialog.value = true;
  }
}

// --- STATUS TRACKER CONFIGURATION (UPDATED) ---
// Define tracker steps directly using your backend status names for the main progression
const trackerSteps = ref([
    { name: 'Pending', icon: STATUS_CONFIG.Pending.icon },
    { name: 'Processing', icon: STATUS_CONFIG.Processing.icon },
    { name: 'Approved', icon: STATUS_CONFIG.Approved.icon },
    { name: 'Returned', icon: STATUS_CONFIG.Returned.icon },
    { name: 'Resolved', icon: STATUS_CONFIG.Resolved.icon }
]);

// Computed properties for tracker failure states
const isRejected = computed(() => transactionData.value?.status === 'Rejected');
const isLostOrDamaged = computed(() => transactionData.value?.status === 'Lost' || transactionData.value?.status === 'Damaged');
const isFailureState = computed(() => isRejected.value || isLostOrDamaged.value);

const activeStepIndex = computed(() => {
  if (!transactionData.value) return -1;

  const currentStatus = transactionData.value.status;
  const stepNames = trackerSteps.value.map(step => step.name);

  // Handle failure states first
  if (isRejected.value) {
    // Rejected typically happens during or after 'Processing'.
    // We set 'Processing' as the failure point (index 1 in trackerSteps).
    return stepNames.indexOf('Processing');
  }
  if (isLostOrDamaged.value) {
    // Lost/Damaged happens after 'Approved' (item has been released).
    // We set 'Approved' as the failure point (index 2 in trackerSteps).
    return stepNames.indexOf('Approved');
  }

  // Handle normal progression statuses and 'Overdue'
  let index = stepNames.indexOf(currentStatus);
  
  // 'Overdue' is a state that occurs when the item is 'Approved' but not returned on time.
  // From the tracker's progression, it's still at the 'Approved' stage awaiting return/resolution.
  if (currentStatus === 'Overdue') {
      index = stepNames.indexOf('Approved');
  }

  return index;
});

const progressWidth = computed(() => {
  if (activeStepIndex.value < 0) return '0%';
  // Ensure we don't divide by zero if there's only one step
  const totalStepsForProgressBar = trackerSteps.value.length > 1 ? (trackerSteps.value.length - 1) : 1;
  const percentage = (activeStepIndex.value / totalStepsForProgressBar) * 100;
  return `${percentage}%`;
});


// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => {
    await fetchTransaction();
});

async function fetchTransaction() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`);
    if (error.value || !data.value?.transaction) throw new Error('Transaction not found or could not be loaded.');
    
    let currentTransaction = data.value.transaction;

    // Auto-update 'Pending' to 'Processing'
    if (currentTransaction.status === 'Pending') {
      const { data: updateData, error: updateError } = await useMyFetch(`/api/borrowed-assets/${transactionId}/status`, {
        method: 'PATCH', body: { status: 'Processing' }
      });

      if (updateError.value) {
        console.warn('Could not auto-update status to Processing.', updateError.value);
      } else {
        currentTransaction = updateData.value.transaction;
      }
    }
    
    transactionData.value = currentTransaction;
    resetForm();

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    loading.value = false;
  }
}

// --- FORM & UI LOGIC ---
function resetForm() {
    Object.assign(form, {
        item_borrowed: transactionData.value.item_borrowed,
        quantity_borrowed: transactionData.value.quantity_borrowed,
        borrow_datetime: formatDateTimeForInput(transactionData.value.borrow_datetime),
        expected_return_date: formatDateTimeForInput(transactionData.value.expected_return_date, false),
        notes: transactionData.value.notes || ''
    });
}

const toggleEditMode = (enable) => { editMode.value = enable; if (!enable) resetForm(); };
const cancelEdit = () => toggleEditMode(false);
const fileSizeRule = (value) => {
    if (!value || !value.length) return true;
    const file = value[0];
    return file.size < 2000000 || 'Image size should be less than 2 MB!';
};

// --- API ACTIONS ---
async function saveChanges() {
  isSaving.value = true;
  try {
    const payload = { ...form, borrow_datetime: new Date(form.borrow_datetime).toISOString(), expected_return_date: new Date(form.expected_return_date).toISOString() };
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'PUT', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update.');
    
    $toast.fire({ title: 'Transaction updated!', icon: 'success' });
    await fetchTransaction(); 
    toggleEditMode(false);
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { isSaving.value = false; }
}

async function updateStatus(newStatus, promptForReason = false) {
    if (newStatus === transactionData.value.status) return;

    let apiPayload = { status: newStatus };

    if (promptForReason) {
        const { value: reason, isConfirmed } = await Swal.fire({
            title: `Confirm: ${newStatus}`,
            text: `Please provide a reason for this status change. This will be recorded.`,
            input: 'text',
            icon: 'warning',
            showConfirmButton: true,
            showCancelButton: true,
            confirmButtonText: 'Confirm',
            inputValidator: (value) => {
                if (!value) {
                    return 'A reason is required to proceed.';
                }
            }
        });

        if (!isConfirmed) return; // Exit if the user clicks "Cancel"
        
        // Add the provided reason to the API payload
        apiPayload.notes = reason;
    }

    // Call the API to update the status
    try {
        const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}/status`, {
            method: 'PATCH', 
            body: apiPayload,
        });
        if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
        
        $toast.fire({ title: data.value.message, icon: 'success' });
        
        await fetchTransaction(); // Refresh data from the server

    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    }
}

async function processReturn() {
    isReturning.value = true;
    let imageBase64 = null;
    const file = returnForm.proofImage ? returnForm.proofImage[0] : null;

    if (file) {
        if (file.size > 2000000) {
            $toast.fire({ title: 'File is too large!', text: 'Please upload an image smaller than 2MB.', icon: 'error' });
            isReturning.value = false;
            return;
        }
        try {
            imageBase64 = await fileToBase64(file);
        } catch (e) {
            console.error("Error converting file to Base64:", e);
            $toast.fire({ title: 'Could not process image file.', icon: 'error' });
            isReturning.value = false;
            return;
        }
    }

    try {
        const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}/return`, {
            method: 'PATCH',
            body: {
                return_proof_image_base64: imageBase64,
                return_condition_notes: returnForm.conditionNotes,
            },
        });
        if (error.value) throw new Error(error.value.data?.message || 'Failed to process return.');
        $toast.fire({ title: 'Item successfully marked as Returned!', icon: 'success' });
        await fetchTransaction();
        returnForm.proofImage = null;
        returnForm.conditionNotes = '';
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { isReturning.value = false; }
}

async function deleteTransaction() {
    isDeleting.value = true;
    try {
        const { error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`, { method: 'DELETE' });
        if (error.value) throw new Error('Failed to delete transaction.');
        $toast.fire({ title: 'Transaction deleted!', icon: 'success' });
        router.push('/borrowed-assets');
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { isDeleting.value = false; confirmDeleteDialog.value = false; }
}

// --- HELPER FUNCTIONS ---
function getStepIcon(index, defaultIcon) {
    if (isFailureState.value) {
        // For failure states, steps *before* the activeStepIndex are marked as 'completed'
        // The activeStepIndex itself is the 'failure-point'
        if (index < activeStepIndex.value) return 'mdi-check';
        if (index === activeStepIndex.value) return 'mdi-close';
        return defaultIcon;
    }
    // Normal successful flow
    if (index < activeStepIndex.value) {
        return 'mdi-check';
    }
    return defaultIcon;
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});

function formatDateTimeForInput(isoString, includeTime = true) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (includeTime) return date.toISOString().slice(0, 16);
        return date.toISOString().split('T')[0];
    } catch(e) { return ''; }
}

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
</script>

<style scoped>
.v-label {
    opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block; margin-bottom: 4px; font-weight: 500;
}
.ga-2 { gap: 8px; }
.cursor-pointer {
    cursor: pointer;
}

/* Status Tracker Styles (Copied from document requests [id].vue) */
.status-tracker-container {
  position: relative;
  width: 100%;
  padding: 0 20px;
  box-sizing: border-box;
}
.steps-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}
.progress-bar-container {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  width: 100%;
  padding: 0 40px;
  box-sizing: border-box;
  z-index: 1;
}
.progress-bar-bg, .progress-bar-fg {
  height: 4px;
  border-radius: 2px;
  position: absolute;
  top: 50%;
  width: 90%; /* Adjust if needed to fit tracker steps */
  transform: translateY(-50%);
}
.progress-bar-bg {
  width: 90%; /* Adjust if needed to fit tracker steps */
  background-color: #e0e0e0;
}
.progress-bar-fg {
  background-color: rgb(var(--v-theme-primary));
  transition: width 0.4s ease-in-out;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100px; /* Adjust width as needed for spacing */
}
.step-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: white;
  border: 3px solid #e0e0e0;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.4s, border-color 0.4s;
}
.step-circle .v-icon {
  color: #9e9e9e;
  transition: color 0.4s;
}
.step-circle.current {
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.current .v-icon {
  color: rgb(var(--v-theme-primary));
}
.step-circle.completed {
  background-color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.completed .v-icon {
  color: white;
}
.step-circle.declined { /* Used for steps before a failure point */
  background-color: rgb(var(--v-theme-error));
  border-color: rgb(var(--v-theme-error));
}
.step-circle.declined .v-icon {
  color: white;
}
.step-circle.failure-point {
  background-color: rgb(var(--v-theme-error));
  border-color: rgb(var(--v-theme-error));
  box-shadow: 0 0 10px 2px rgba(var(--v-theme-error-rgb), 0.5);
}
.step-circle.failure-point .v-icon {
  color: white;
}
.step-label {
  font-size: 0.875rem;
  color: #757575;
  transition: color 0.4s, font-weight 0.4s;
}
</style>