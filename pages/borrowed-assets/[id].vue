<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4 text-grey-darken-1">Loading Transaction Details...</p>
    </div>
    <v-alert v-else-if="!transactionData || !transactionData._id" type="error" prominent border="start">
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
          <p class="text-grey-darken-1">Ref #: {{ transactionData.ref_no }}</p>
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

          <!-- ✨ Borrowing Proof (Photo) Display ✨ -->
          <v-card flat border prepend-icon="mdi-camera" title="Borrowing Proof (Photo)" class="mt-4">
            <v-card-text>
              <div v-if="transactionData.borrow_proof_image_base64" class="pa-2">
                  <v-img
                    :src="transactionData.borrow_proof_image_base64"
                    max-height="300"
                    class="elevation-2 rounded-lg border cursor-pointer"
                    @click="openGallery('borrow_proof')"
                  ></v-img>
                  <p class="text-caption text-grey-darken-1 mt-2">Click image to enlarge</p>
              </div>
              <v-alert v-else type="info" variant="tonal" text="No borrowing proof was uploaded."></v-alert>
            </v-card-text>
          </v-card>
          <!-- ✨ END Borrowing Proof (Photo) Display ✨ -->

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
                <div v-if="['Approved', 'Overdue'].includes(transactionData.status)">
                    <v-card-text>
                        <p class="text-body-2 mb-4">Once the resident returns the item, upload proof and add notes on its condition.</p>
                        
                        <!-- NEW: Button to open upload options for return proof -->
                        <v-btn
                          block
                          size="large"
                          color="primary"
                          variant="tonal"
                          @click="uploadReturnOptionsDialog = true"
                          prepend-icon="mdi-camera"
                          class="mb-4"
                        >
                          Upload or Capture Return Proof
                        </v-btn>

                        <!-- Hidden file input for "Upload from Device" option for return proof -->
                        <input
                          type="file"
                          ref="returnFileInput"
                          accept="image/*"
                          style="display: none;"
                          @change="handleReturnFileChange"
                        />

                        <v-img
                          v-if="finalReturnProofBase64"
                          :src="finalReturnProofBase64"
                          max-height="200"
                          contain
                          class="mt-2 border rounded"
                          alt="Return proof preview"
                        ></v-img>
                        <p v-else class="text-caption text-grey-darken-1 mt-2">
                          No return proof photo selected.
                        </p>


                        <v-textarea v-model="returnForm.conditionNotes" label="Notes on Return Condition" placeholder="e.g., 'Returned in good condition'" variant="outlined" rows="3" class="mt-4"></v-textarea>
                    </v-card-text>
                    <v-card-actions class="pa-4 flex-wrap">
                        <v-btn color="success" variant="flat" @click="processReturn" :loading="isReturning" prepend-icon="mdi-keyboard-return" size="large">Mark as Returned</v-btn>
                        <v-btn color="error" variant="flat" @click="updateStatus('Damaged')" prepend-icon="mdi-alert-octagon-outline" size="large">Mark as Damaged</v-btn>
                        <v-btn color="error" variant="flat" @click="updateStatus('Lost')" prepend-icon="mdi-delete-forever" size="large">Mark as Lost</v-btn>
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
                        <!-- ✨ UPDATED: Display return_proof_image_base64 ✨ -->
                        <div v-if="transactionData.return_proof_image_base64" class="pa-2 mt-2">
                            <p class="text-subtitle-2 mb-2">Return Proof:</p>
                            <v-img :src="transactionData.return_proof_image_base64" max-height="300" class="elevation-2 rounded-lg border cursor-pointer" @click="openGallery('return_proof')"></v-img>
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

    <!-- NEW: DIALOG FOR UPLOAD OPTIONS (File or Camera) for Return Proof -->
    <v-dialog v-model="uploadReturnOptionsDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Upload Return Proof</v-card-title>
        <v-card-text>
          <v-list density="comfortable">
            <v-list-item link @click="triggerReturnFileInput">
              <template v-slot:prepend>
                <v-icon>mdi-file-upload-outline</v-icon>
              </template>
              <v-list-item-title>Upload from Device</v-list-item-title>
            </v-list-item>
            <v-list-item link @click="openReturnCameraDialog">
              <template v-slot:prepend>
                <v-icon>mdi-camera-outline</v-icon>
              </template>
              <v-list-item-title>Capture Photo</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="uploadReturnOptionsDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- NEW: DIALOG FOR CAMERA CAPTURE for Return Proof -->
    <v-dialog v-model="returnCameraDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-toolbar-title>Capture Return Proof Photo</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="closeReturnCamera">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="d-flex flex-column justify-center align-center camera-card-content">
          <div v-if="returnCameraPermissionError" class="text-center pa-4">
            <v-icon size="64" color="red-lighten-1">mdi-camera-off</v-icon>
            <p class="text-h6 mt-2 text-white">Camera access denied.</p>
            <p class="text-caption text-grey-lighten-1">
              Please enable camera permissions for this site in your browser settings (e.g., Chrome Settings > Privacy and security > Site settings > Camera)
              and then try again.
            </p>
            <v-btn color="primary" class="mt-4" @click="startReturnCamera">Retry Camera</v-btn>
          </div>
          <div v-else class="camera-display-wrapper">
            <video ref="returnVideoElement" autoplay playsinline class="camera-feed" v-show="!capturedReturnImage"></video>
            <canvas ref="returnCanvasElement" class="captured-preview" v-show="capturedReturnImage"></canvas>

            <div v-if="!isReturnCameraActive && !capturedReturnImage" class="camera-status-overlay">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
              <p class="mt-2 text-white">Starting camera...</p>
              <p class="text-caption text-grey-lighten-1">
                If the camera doesn't start, please ensure you've granted permission.
              </p>
            </div>

            <div class="camera-controls" v-if="isReturnCameraActive || capturedReturnImage">
              <v-btn v-if="!capturedReturnImage" color="primary" icon="mdi-camera" size="x-large" @click="takeReturnPhoto"></v-btn>
              <template v-else>
                <v-btn color="error" class="mr-2" prepend-icon="mdi-refresh" @click="retakeReturnPhoto">Retake</v-btn>
                <v-btn color="success" prepend-icon="mdi-check-circle" @click="saveCapturedReturnPhoto">Save Photo</v-btn>
              </template>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, computed, onBeforeUnmount, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import Swal from 'sweetalert2';

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
const transactionData = ref(null); // Initialized as null for explicit "no data" state
const form = reactive({ item_borrowed: '', quantity_borrowed: 1, borrow_datetime: '', expected_return_date: '', notes: '' });
const returnForm = reactive({ uploadedReturnProofFile: null, conditionNotes: '' }); // Changed `proofImage` to `uploadedReturnProofFile`

const loading = ref(true);
const editMode = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isReturning = ref(false);
const confirmDeleteDialog = ref(false);

const galleryDialog = ref(false);
const currentGalleryIndex = ref(0);

// NEW: State for return proof upload/capture
const uploadReturnOptionsDialog = ref(false);
const returnCameraDialog = ref(false);
const returnVideoElement = ref(null);
const returnCanvasElement = ref(null);
let returnMediaStream = null;
const capturedReturnImage = ref('');
const isReturnCameraActive = ref(false);
const returnCameraPermissionError = ref(false);
const returnFileInput = ref(null);

// Centralized ref for the final return proof image (Base64)
const finalReturnProofBase64 = ref('');


// ✨ UPDATED: imageGallerySource computed property to include both Base64 proofs ✨
const imageGallerySource = computed(() => {
  const items = [];
  if (transactionData.value?.borrow_proof_image_base64) {
    items.push({
      id: 'borrow_proof',
      src: transactionData.value.borrow_proof_image_base64,
      title: 'Borrowing Proof'
    });
  }
  // Use `transactionData.value.return_proof_image_base64` directly from fetched data
  if (transactionData.value?.return_proof_image_base64) {
    items.push({
      id: 'return_proof',
      src: transactionData.value.return_proof_image_base64,
      title: 'Return Proof'
    });
  }
  return items;
});

// ✨ UPDATED: openGallery function to correctly find the image in the gallerySource ✨
function openGallery(id) {
  const foundIndex = imageGallerySource.value.findIndex(item => item.id === id);
  if (foundIndex > -1) {
    currentGalleryIndex.value = foundIndex;
    galleryDialog.value = true;
  } else {
    console.warn(`Image with ID '${id}' not found in gallery source.`);
    $toast.fire({ title: 'Image not available or corrupted.', icon: 'warning' });
  }
}

// --- STATUS TRACKER CONFIGURATION (UPDATED) ---
const trackerSteps = ref([
    { name: 'Pending', icon: STATUS_CONFIG.Pending.icon },
    { name: 'Processing', icon: STATUS_CONFIG.Processing.icon },
    { name: 'Approved', icon: STATUS_CONFIG.Approved.icon },
    { name: 'Returned', icon: STATUS_CONFIG.Returned.icon },
    { name: 'Resolved', icon: STATUS_CONFIG.Resolved.icon }
]);

const isRejected = computed(() => transactionData.value?.status === 'Rejected');
const isLostOrDamaged = computed(() => transactionData.value?.status === 'Lost' || transactionData.value?.status === 'Damaged');
const isFailureState = computed(() => isRejected.value || isLostOrDamaged.value);

const activeStepIndex = computed(() => {
  if (!transactionData.value) return -1;

  const currentStatus = transactionData.value.status;
  const stepNames = trackerSteps.value.map(step => step.name);

  if (isRejected.value) {
    return stepNames.indexOf('Processing');
  }
  if (isLostOrDamaged.value) {
    return stepNames.indexOf('Approved');
  }

  let index = stepNames.indexOf(currentStatus);
  if (currentStatus === 'Overdue') {
      index = stepNames.indexOf('Approved');
  }
  return index;
});

const progressWidth = computed(() => {
  if (activeStepIndex.value < 0) return '0%';
  const totalStepsForProgressBar = trackerSteps.value.length > 1 ? (trackerSteps.value.length - 1) : 1;
  const percentage = (activeStepIndex.value / totalStepsForProgressBar) * 100;
  return `${percentage}%`;
});


// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => {
    await fetchTransaction();
});

onBeforeUnmount(() => {
  stopReturnCameraStream(); // Ensure camera is stopped if component is unmounted
});

async function fetchTransaction() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}`);
    if (error.value || !data.value?.transaction) {
      transactionData.value = null; // Explicitly set to null on error or no data
      throw new Error('Transaction not found or could not be loaded.');
    }

    let currentTransaction = data.value.transaction;

    // Auto-update 'Pending' to 'Processing'
    if (currentTransaction.status === 'Pending') {
      const { data: updateData, error: updateError } = await useMyFetch(`/api/borrowed-assets/${transactionId}/status`, {
        method: 'PATCH', body: { status: 'Processing' }
      });

      if (updateError.value) {
        console.warn('Could not auto-update status to Processing.', updateError.value);
      } else if (updateData.value?.transaction) {
        currentTransaction = updateData.value.transaction;
      }
    }

    transactionData.value = currentTransaction;
    resetForm();

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    transactionData.value = null; // Ensure it's null when an error occurs
  } finally {
    loading.value = false;
  }
}

// --- FORM & UI LOGIC ---
// ✨ UPDATED: resetForm to be robust against null transactionData.value ✨
function resetForm() {
    if (!transactionData.value) {
        Object.assign(form, { item_borrowed: '', quantity_borrowed: 0, borrow_datetime: '', expected_return_date: '', notes: '' });
        return;
    }

    Object.assign(form, {
        item_borrowed: transactionData.value.item_borrowed,
        quantity_borrowed: transactionData.value.quantity_borrowed,
        borrow_datetime: formatDateTimeForInput(transactionData.value.borrow_datetime),
        expected_return_date: formatDateTimeForInput(transactionData.value.expected_return_date, false),
        notes: transactionData.value.notes || ''
    });
    // Clear return form fields and image when transaction data is loaded/reset
    returnForm.uploadedReturnProofFile = null;
    returnForm.conditionNotes = '';
    finalReturnProofBase64.value = '';
}

const toggleEditMode = (enable) => { editMode.value = enable; if (!enable) resetForm(); };
const cancelEdit = () => toggleEditMode(false);

// ✨ UPDATED: fileSizeRule to handle single File object for v-file-input consistently ✨
const fileSizeRule = (value) => {
    if (!returnForm.uploadedReturnProofFile) return true; // No file selected via input is valid

    const fileToValidate = returnForm.uploadedReturnProofFile;
    return fileToValidate.size < 2000000 || 'Image size should be less than 2 MB!';
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

        if (!isConfirmed) return;

        apiPayload.notes = reason;
    }

    try {
        const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}/status`, {
            method: 'PATCH',
            body: apiPayload,
        });
        if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');

        $toast.fire({ title: data.value.message, icon: 'success' });

        await fetchTransaction();

    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    }
}

async function processReturn() {
    isReturning.value = true;

    // Client-side validation for image size for uploaded files
    if (returnForm.uploadedReturnProofFile) {
        if (returnForm.uploadedReturnProofFile.size > 2 * 1024 * 1024) { // 2MB limit
            $toast.fire({ title: 'Uploaded return proof file is too large!', text: 'Please upload an image smaller than 2MB.', icon: 'error' });
            isReturning.value = false;
            return;
        }
    }

    try {
        const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionId}/return`, {
            method: 'PATCH',
            body: {
                return_proof_image_base64: finalReturnProofBase64.value, // Use the unified finalReturnProofBase64
                return_condition_notes: returnForm.conditionNotes,
            },
        });
        if (error.value) throw new Error(error.value.data?.message || 'Failed to process return.');
        $toast.fire({ title: 'Item successfully marked as Returned!', icon: 'success' });
        await fetchTransaction();
        // Reset return-related state after successful return
        returnForm.uploadedReturnProofFile = null;
        returnForm.conditionNotes = '';
        finalReturnProofBase64.value = '';
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
        if (index < activeStepIndex.value) return 'mdi-check';
        if (index === activeStepIndex.value) return 'mdi-close';
        return defaultIcon;
    }
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

// --- NEW RETURN PROOF UPLOAD/CAMERA FUNCTIONS ---
function triggerReturnFileInput() {
  uploadReturnOptionsDialog.value = false;
  returnFileInput.value.click();
}

async function handleReturnFileChange(event) {
  uploadReturnOptionsDialog.value = false;
  const file = event.target.files[0];
  if (!file) {
    finalReturnProofBase64.value = '';
    returnForm.uploadedReturnProofFile = null;
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    $toast.fire({ title: 'File size should not exceed 2MB.', icon: 'warning' });
    if (returnFileInput.value) returnFileInput.value.value = '';
    finalReturnProofBase64.value = '';
    returnForm.uploadedReturnProofFile = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    finalReturnProofBase64.value = e.target.result;
    returnForm.uploadedReturnProofFile = file; // Store the File object for validation
    if (returnFileInput.value) returnFileInput.value.value = '';
  };
  reader.onerror = (e) => {
    console.error("FileReader error:", e);
    $toast.fire({ title: 'Could not read the file.', icon: 'error' });
    finalReturnProofBase64.value = '';
    returnForm.uploadedReturnProofFile = null;
    if (returnFileInput.value) returnFileInput.value.value = '';
  };
  reader.readAsDataURL(file);
}

function openReturnCameraDialog() {
  uploadReturnOptionsDialog.value = false;
  returnCameraDialog.value = true;
  startReturnCamera();
}

async function startReturnCamera() {
  isReturnCameraActive.value = false;
  returnCameraPermissionError.value = false;
  capturedReturnImage.value = '';
  stopReturnCameraStream();

  await nextTick();
  if (!returnVideoElement.value) {
    console.error("Return video element not found in DOM after nextTick.");
    $toast.fire({
        title: 'Camera initialization failed: video element not ready.',
        icon: 'error',
        timer: 3000
    });
    returnCameraDialog.value = false;
    return;
  }
  
  try {
    returnMediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    returnVideoElement.value.srcObject = returnMediaStream;

    const videoLoadedPromise = new Promise((resolve, reject) => {
      returnVideoElement.value.onloadedmetadata = () => {
        resolve();
      };
      returnVideoElement.value.onerror = (e) => {
        reject(new Error(`Video element error: ${e.message || 'Unknown'}`));
      };

      setTimeout(() => {
        if (!isReturnCameraActive.value) {
          reject(new Error("Camera stream metadata load timed out (5s)."));
        }
      }, 5000);
    });

    await videoLoadedPromise;
    isReturnCameraActive.value = true;
  } catch (err) {
    console.error("Error accessing return camera:", err);
    isReturnCameraActive.value = false;
    stopReturnCameraStream();

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      returnCameraPermissionError.value = true;
      $toast.fire({
        title: 'Camera access denied. Please enable camera permissions for this site in your browser settings and try again.',
        icon: 'error',
        timer: 6000
      });
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      $toast.fire({
        title: 'No camera found on your device.',
        icon: 'error',
        timer: 5000
      });
      returnCameraDialog.value = false;
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      $toast.fire({
        title: 'Camera is already in use or could not be started. Try closing other apps using the camera.',
        icon: 'error',
        timer: 6000
      });
      returnCameraDialog.value = false;
    } else if (err.name === 'OverconstrainedError') {
       $toast.fire({
        title: 'Camera not available with requested settings (e.g., no rear camera).',
        icon: 'warning',
        timer: 5000
      });
      returnCameraDialog.value = false;
    } else if (err.message.includes("Camera stream metadata load timed out")) {
        $toast.fire({
            title: 'Camera failed to initialize within expected time. Please try again.',
            icon: 'error',
            timer: 5000
        });
        returnCameraDialog.value = false;
    }
    else {
      $toast.fire({
        title: `Could not access camera: ${err.message || 'Unknown error.'}`,
        icon: 'error',
        timer: 5000
      });
      returnCameraDialog.value = false;
    }
  }
}

function stopReturnCameraStream() {
  if (returnMediaStream) {
    returnMediaStream.getTracks().forEach(track => track.stop());
    returnMediaStream = null;
    if (returnVideoElement.value) {
      returnVideoElement.value.srcObject = null;
    }
  }
  isReturnCameraActive.value = false;
}

function takeReturnPhoto() {
  if (!returnVideoElement.value || !returnCanvasElement.value) return;

  const video = returnVideoElement.value;
  const canvas = returnCanvasElement.value;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');
  context.save();
  if (getComputedStyle(video).transform.includes('scaleX(-1)')) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  
  capturedReturnImage.value = canvas.toDataURL('image/jpeg', 0.9);
  stopReturnCameraStream();
}

function retakeReturnPhoto() {
  capturedReturnImage.value = '';
  startReturnCamera();
}

function saveCapturedReturnPhoto() {
  if (capturedReturnImage.value) {
    finalReturnProofBase64.value = capturedReturnImage.value; // Set the unified base64
    returnForm.uploadedReturnProofFile = null; // Clear any explicitly uploaded file
    returnCameraDialog.value = false;
    capturedReturnImage.value = '';
  } else {
    $toast.fire({ title: 'No photo captured yet.', icon: 'warning' });
  }
}

function closeReturnCamera() {
  stopReturnCameraStream();
  returnCameraDialog.value = false;
  capturedReturnImage.value = '';
  returnCameraPermissionError.value = false;
}

watch(returnCameraDialog, (newValue) => {
  if (!newValue) {
    stopReturnCameraStream();
    capturedReturnImage.value = '';
    returnCameraPermissionError.value = false;
  }
});

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

/* Camera Dialog Specific Styles */
.camera-card-content {
  background-color: #333; /* Dark background for camera feed */
  height: 100%;
  flex-grow: 1;
  position: relative;
  overflow: hidden; /* Ensure video/canvas don't overflow */
}

.camera-display-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%; /* Limit width on larger screens */
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.camera-feed, .captured-preview {
  width: 100%;
  height: auto;
  max-height: 80vh; /* Adjust as needed */
  object-fit: contain; /* Ensure entire video/image is visible */
  background-color: black;
  border-radius: 8px;
  /* Add this line to un-mirror the horizontally "inverted" camera feed */
  transform: scaleX(-1);
}

.camera-status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7); /* Semi-transparent overlay */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  text-align: center;
  border-radius: 8px; /* Matches camera-feed border-radius */
}

.camera-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 16px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 12px 20px;
  border-radius: 30px;
}
</style>