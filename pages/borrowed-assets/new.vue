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
                readonly
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

          <!-- NEW: Upload Proof of Borrowing Photo -->
          <v-row>
            <v-col cols="12">
              <label class="v-label mb-1">Upload Proof of Borrowing (Photo) (Optional)</label>
              
              <!-- Button to open upload options -->
              <v-btn
                block
                size="large"
                color="primary"
                variant="tonal"
                @click="uploadOptionsDialog = true"
                prepend-icon="mdi-camera"
                class="mb-4"
              >
                Upload or Capture Proof of Borrowing
              </v-btn>

              <!-- Hidden file input for "Upload from Device" option -->
              <input
                type="file"
                ref="fileInput"
                accept="image/*"
                style="display: none;"
                @change="handleUploadedFileChange"
              />

              <v-img
                v-if="finalBorrowProofBase64"
                :src="finalBorrowProofBase64"
                max-height="300"
                contain
                class="mt-4 border rounded"
                alt="Proof of borrowing preview"
              ></v-img>

              <p v-else class="text-caption text-grey-darken-1 mt-2">
                No photo selected. Click the button above to add one.
              </p>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <!-- NEW: DIALOG FOR UPLOAD OPTIONS (File or Camera) -->
    <v-dialog v-model="uploadOptionsDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Upload Proof of Borrowing</v-card-title>
        <v-card-text>
          <v-list density="comfortable">
            <v-list-item link @click="triggerFileInput">
              <template v-slot:prepend>
                <v-icon>mdi-file-upload-outline</v-icon>
              </template>
              <v-list-item-title>Upload from Device</v-list-item-title>
            </v-list-item>
            <v-list-item link @click="openCameraDialog">
              <template v-slot:prepend>
                <v-icon>mdi-camera-outline</v-icon>
              </template>
              <v-list-item-title>Capture Photo</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="uploadOptionsDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- NEW: DIALOG FOR CAMERA CAPTURE -->
    <v-dialog v-model="cameraDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-toolbar-title>Capture Proof Photo</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="closeCamera">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="d-flex flex-column justify-center align-center camera-card-content">
          <div v-if="cameraPermissionError" class="text-center pa-4">
            <v-icon size="64" color="red-lighten-1">mdi-camera-off</v-icon>
            <p class="text-h6 mt-2 text-white">Camera access denied.</p>
            <p class="text-caption text-grey-lighten-1">
              Please enable camera permissions for this site in your browser settings (e.g., Chrome Settings > Privacy and security > Site settings > Camera)
              and then try again.
            </p>
            <v-btn color="primary" class="mt-4" @click="startCamera">Retry Camera</v-btn>
          </div>
          <div v-else class="camera-display-wrapper">
            <!-- The video element is always present here when not in permission error state -->
            <video ref="videoElement" autoplay playsinline class="camera-feed" v-show="!capturedImage"></video>
            <canvas ref="canvasElement" class="captured-preview" v-show="capturedImage"></canvas>

            <!-- Loading overlay when camera is not active and no image captured -->
            <div v-if="!isCameraActive && !capturedImage" class="camera-status-overlay">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
              <p class="mt-2 text-white">Starting camera...</p>
              <p class="text-caption text-grey-lighten-1">
                If the camera doesn't start, please ensure you've granted permission.
              </p>
            </div>

            <!-- Controls (only show if camera is active or an image is captured) -->
            <div class="camera-controls" v-if="isCameraActive || capturedImage">
              <!-- FIX: Changed @end to @click for the takePhoto button -->
              <v-btn v-if="!capturedImage" color="primary" icon="mdi-camera" size="x-large" @click="takePhoto"></v-btn>
              <template v-else>
                <v-btn color="error" class="mr-2" prepend-icon="mdi-refresh" @click="retakePhoto">Retake</v-btn>
                <v-btn color="success" prepend-icon="mdi-check-circle" @click="saveCapturedPhoto">Save Photo</v-btn>
              </template>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
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
  uploadedBorrowProofFile: null, // This will temporarily hold a File object for direct uploads
});

// Resident search state
const borrowerSearchQuery = ref('');
const borrowerSearchResults = ref([]);
const isLoadingBorrowers = ref(false);
const selectedBorrower = ref(null);

// Inventory state
const inventoryItems = ref([]);
const isLoadingInventory = ref(true);

// NEW: Camera and Upload specific state
const uploadOptionsDialog = ref(false);
const cameraDialog = ref(false);
const videoElement = ref(null); // Ref for the video element
const canvasElement = ref(null); // Ref for the canvas element
let mediaStream = null; // To hold the camera stream
const capturedImage = ref(''); // To hold the base64 of the captured image within the camera dialog
const isCameraActive = ref(false); // To track if camera is actively streaming
const cameraPermissionError = ref(false); // To track if camera permission was denied

const fileInput = ref(null); // Ref for the hidden file input for device upload

// This will store the final base64 string for the proof image, whether from upload or camera
const finalBorrowProofBase64 = ref('');


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
  // Rule for file size validation - only for explicitly uploaded files (not camera capture as its handled separately)
  fileSizeRule: () => {
    if (!transaction.uploadedBorrowProofFile) return true; // No file selected is valid for this rule

    const fileToValidate = transaction.uploadedBorrowProofFile;
    return fileToValidate.size < 2000000 || 'Image size should be less than 2 MB!';
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

onBeforeUnmount(() => {
  stopCameraStream(); // Ensure camera is stopped if component is unmounted
});

const onItemSelect = () => {
  transaction.quantity_borrowed = 1;
};

// Helper function to convert file to Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});

async function saveTransaction() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the errors in the form.', icon: 'error' });
    return;
  }

  saving.value = true;

  // Perform client-side file size check for uploaded file (camera image size implicitly handled)
  // This check is primarily for files chosen via the "Upload from Device" option
  if (transaction.uploadedBorrowProofFile) {
      if (transaction.uploadedBorrowProofFile.size > 2 * 1024 * 1024) { // 2MB limit
          $toast.fire({ title: 'Uploaded file is too large!', text: 'Please upload an image smaller than 2MB.', icon: 'error' });
          saving.value = false;
          return;
      }
  }

  try {
    const payload = {
      borrower_resident_id: selectedBorrower.value._id,
      borrower_display_name: selectedBorrower.value.fullName,
      borrow_datetime: new Date(transaction.borrow_datetime).toISOString(),
      borrowed_from_personnel: transaction.borrowed_from_personnel,
      item_borrowed: transaction.item_borrowed,
      quantity_borrowed: transaction.quantity_borrowed,
      expected_return_date: new Date(transaction.expected_return_date).toISOString(),
      notes: transaction.notes,
      borrow_proof_image_base64: finalBorrowProofBase64.value, // Use the unified base64 ref
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

// --- NEW UPLOAD/CAMERA FUNCTIONS ---
function triggerFileInput() {
  uploadOptionsDialog.value = false; // Close current dialog
  // Programmatically click the hidden file input
  fileInput.value.click();
}

async function handleUploadedFileChange(event) {
  uploadOptionsDialog.value = false; // Close upload options dialog
  const file = event.target.files[0]; // Access the first file
  if (!file) {
    finalBorrowProofBase64.value = ''; // Clear previous image
    transaction.uploadedBorrowProofFile = null; // Clear file object
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    $toast.fire({ title: 'File size should not exceed 2MB.', icon: 'warning' });
    if (fileInput.value) fileInput.value.value = ''; // Clear the file input value
    finalBorrowProofBase64.value = ''; // Clear previous image
    transaction.uploadedBorrowProofFile = null; // Clear file object
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    finalBorrowProofBase64.value = e.target.result;
    transaction.uploadedBorrowProofFile = file; // Keep the actual File object if needed later
    if (fileInput.value) fileInput.value.value = ''; // Clear the file input value after reading
  };
  reader.onerror = (e) => {
    console.error("FileReader error:", e);
    $toast.fire({ title: 'Could not read the file.', icon: 'error' });
    finalBorrowProofBase64.value = ''; // Clear previous image
    transaction.uploadedBorrowProofFile = null; // Clear file object
    if (fileInput.value) fileInput.value.value = ''; // Clear input on error
  };
  reader.readAsDataURL(file);
}

function openCameraDialog() {
  uploadOptionsDialog.value = false; // Close current dialog
  cameraDialog.value = true;
  startCamera();
}

async function startCamera() {
  isCameraActive.value = false;
  cameraPermissionError.value = false; // Reset permission error
  capturedImage.value = ''; // Reset captured image (in case retrying)

  // Stop any existing stream before starting a new one
  stopCameraStream();

  // Ensure the video element is rendered and available in the DOM
  await nextTick();
  if (!videoElement.value) {
    console.error("Video element not found in DOM after nextTick.");
    $toast.fire({
        title: 'Camera initialization failed: video element not ready.',
        icon: 'error',
        timer: 3000
    });
    cameraDialog.value = false; // Close dialog if video element isn't there
    return;
  }
  
  try {
    // Request camera access, preferring the environment (rear) camera
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoElement.value.srcObject = mediaStream;

    const videoLoadedPromise = new Promise((resolve, reject) => {
      videoElement.value.onloadedmetadata = () => {
        resolve();
      };
      videoElement.value.onerror = (e) => {
        reject(new Error(`Video element error: ${e.message || 'Unknown'}`));
      };

      setTimeout(() => {
        if (!isCameraActive.value) {
          reject(new Error("Camera stream metadata load timed out (5s)."));
        }
      }, 5000);
    });

    await videoLoadedPromise;
    isCameraActive.value = true;
  } catch (err) {
    console.error("Error accessing camera:", err);
    isCameraActive.value = false;
    stopCameraStream();

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      cameraPermissionError.value = true;
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
      cameraDialog.value = false;
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      $toast.fire({
        title: 'Camera is already in use or could not be started. Try closing other apps using the camera.',
        icon: 'error',
        timer: 6000
      });
      cameraDialog.value = false;
    } else if (err.name === 'OverconstrainedError') {
       $toast.fire({
        title: 'Camera not available with requested settings (e.g., no rear camera).',
        icon: 'warning',
        timer: 5000
      });
      cameraDialog.value = false;
    } else if (err.message.includes("Camera stream metadata load timed out")) {
        $toast.fire({
            title: 'Camera failed to initialize within expected time. Please try again.',
            icon: 'error',
            timer: 5000
        });
        cameraDialog.value = false;
    }
    else {
      $toast.fire({
        title: `Could not access camera: ${err.message || 'Unknown error.'}`,
        icon: 'error',
        timer: 5000
      });
      cameraDialog.value = false;
    }
  }
}

function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    if (videoElement.value) {
      videoElement.value.srcObject = null;
    }
  }
  isCameraActive.value = false;
}

function takePhoto() {
  if (!videoElement.value || !canvasElement.value) return;

  const video = videoElement.value;
  const canvas = canvasElement.value;
  
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
  
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.9);
  stopCameraStream();
}

function retakePhoto() {
  capturedImage.value = '';
  startCamera();
}

function saveCapturedPhoto() {
  if (capturedImage.value) {
    finalBorrowProofBase64.value = capturedImage.value; // Set the final base64 value
    transaction.uploadedBorrowProofFile = null; // Clear any previously uploaded file
    cameraDialog.value = false;
    capturedImage.value = ''; // Clear captured image from camera dialog state
  } else {
    $toast.fire({ title: 'No photo captured yet.', icon: 'warning' });
  }
}

function closeCamera() {
  stopCameraStream();
  cameraDialog.value = false;
  capturedImage.value = ''; // Clear any pending captured image
  cameraPermissionError.value = false; // Reset permission error on close
}

// Watch for camera dialog opening/closing to manage stream
watch(cameraDialog, (newValue) => {
  if (!newValue) { // When camera dialog closes, ensure stream is stopped and states are reset
    stopCameraStream();
    capturedImage.value = '';
    cameraPermissionError.value = false;
  }
});
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