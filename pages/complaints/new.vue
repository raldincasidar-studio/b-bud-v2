<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">File New Complaint</h2>
        <p class="text-grey-darken-1">Log a new complaint from a resident.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveComplaint" prepend-icon="mdi-content-save" :loading="saving" size="large">
          Submit Complaint
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Complainant Name <span class="text-red">*</span></label>
            <v-autocomplete
              v-model="form.complainant_resident"
              v-model:search="complainantSearchQuery"
              label="Search Complainant (Resident)..."
              variant="outlined"
              :items="complainantSearchResults"
              item-title="name"
              return-object
              :loading="isLoadingComplainants"
              :error-messages="v$.complainant_resident.$errors.map(e => e.$message)"
              @blur="v$.complainant_resident.$touch"
              no-filter
            >
              
              <template v-slot:item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :title="item.raw.name"
                  :subtitle="item.raw.address" 
                  :disabled="item.raw.status !== 'Approved' || item.raw.account_status !== 'Active'"
                >
                  <template v-slot:append>
                    <v-chip
                      v-if="item.raw.status !== 'Approved'"
                      color="orange-darken-1" variant="tonal" size="small" label
                    >
                      {{ item.raw.status }}
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
             <label class="v-label mb-1">Complainant Address <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.complainant_address"
              label="Complainant Address"
              variant="outlined"
              readonly
              :error-messages="v$.complainant_address.$errors.map(e => e.$message)"
              @blur="v$.complainant_address.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Complainant Contact Number <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.contact_number"
              label="Complainant Contact Number"
              variant="outlined"
              readonly
              type="tel"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">Date of Complaint <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.date_of_complaint"
              label="Date of Complaint"
              type="date"
              variant="outlined"
              :error-messages="v$.date_of_complaint.$errors.map(e => e.$message)"
              @blur="v$.date_of_complaint.$touch"
              readonly
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
             <label class="v-label mb-1">Time of Complaint <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.time_of_complaint"
              label="Time of Complaint"
              type="time"
              variant="outlined"
              :error-messages="v$.time_of_complaint.$errors.map(e => e.$message)"
              @blur="v$.time_of_complaint.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-divider class="my-4"></v-divider>
        
       
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Person Complained Against</label>
            <v-text-field
              v-model="form.person_complained_against_name"
              label="Name of Person Complained Against"
              variant="outlined"
              placeholder="Enter full name"
              :error-messages="v$.person_complained_against_name.$errors.map(e => e.$message)"
              @blur="v$.person_complained_against_name.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Initial Status <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.status"
              label="Initial Status"
              variant="outlined"
              readonly
              :error-messages="v$.status.$errors.map(e => e.$message)"
              @blur="v$.status.$touch"
            ></v-text-field>
          </v-col>
        </v-row>

        
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Category <span class="text-red">*</span></label>
            <v-select
              v-model="form.category"
              label="Category"
              :items="complaintCategories"
              variant="outlined"
              placeholder="Select Category"
              :error-messages="v$.category.$errors.map(e => e.$message)"
              @blur="v$.category.$touch"
            ></v-select>
          </v-col>
          <v-col cols="12" md="6">
              <label class="v-label mb-1">Request Processed By (Personnel)</label>
              <v-text-field
                v-model="form.processed_by_personnel"
                variant="outlined"
                readonly
                hint="This is automatically filled with the logged-in user's name."
                :error-messages="v$.processed_by_personnel.$errors.map(e => e.$message)"
                @blur="v$.processed_by_personnel.$touch"
              ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <label class="v-label mb-1">Notes / Description of Complaint <span class="text-red">*</span></label>
            <v-textarea
              v-model="form.notes_description"
              label="Notes / Description of Complaint"
              variant="outlined" rows="5" auto-grow
              :error-messages="v$.notes_description.$errors.map(e => e.$message)"
              @blur="v$.notes_description.$touch"
            ></v-textarea>
          </v-col>
          <v-col cols="12">
             <label class="v-label mb-1">Proof of Complaint</label>
             
             <!-- NEW: Button to open upload options -->
              <v-btn
                block
                size="large"
                color="primary"
                variant="tonal"
                @click="uploadProofOptionsDialog = true"
                prepend-icon="mdi-camera"
                class="mb-4"
              >
                Add Photo or Video Proof ({{ form.proof_files.length }} / 5)
              </v-btn>

              <!-- Hidden file input for "Upload from Device" option -->
              <input
                type="file"
                ref="fileInput"
                accept="image/*,video/*"
                multiple
                style="display: none;"
                @change="handleProofFileChange"
              />

              <!-- Display current proof files and allow removal -->
              <v-row v-if="proofPreviewItems.length > 0" class="mt-4">
                <v-col v-for="(item, index) in proofPreviewItems" :key="item.url || index" cols="6" sm="4" md="3">
                  <v-card flat outlined class="d-flex flex-column justify-center align-center">
                    <v-btn
                      icon="mdi-close-circle"
                      color="error"
                      size="small"
                      class="remove-file-btn"
                      @click="removeProofFile(index)"
                    ></v-btn>
                    <div class="image-video-preview-wrapper">
                      <template v-if="item.type.startsWith('image/')">
                        <v-img :src="item.url" aspect-ratio="1" cover>
                          <template v-slot:placeholder>
                            <v-row class="fill-height ma-0" align="center" justify="center">
                              <v-progress-circular indeterminate color="primary"></v-progress-circular>
                            </v-row>
                          </template>
                          <template v-slot:error>
                            <v-row class="fill-height ma-0" align="center" justify="center">
                              <v-icon size="64" color="error">mdi-image-broken-variant</v-icon>
                            </v-row>
                          </template>
                        </v-img>
                      </template>
                      <template v-else-if="item.type.startsWith('video/')">
                        <video :src="item.url" controls playsinline muted preload="metadata"
                               style="width: 100%; height: 100%; object-fit: contain; background-color: black;"
                               @error="handleVideoError(item.file.name)">
                            Your browser does not support the video tag.
                            <source :src="item.url" :type="item.type">
                        </video>
                      </template>
                      <template v-else>
                        <div class="pa-4 text-center">
                          <v-icon size="64">mdi-file</v-icon>
                          <p class="text-caption mt-2">{{ item.file.name }}</p>
                        </div>
                      </template>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
              <p v-else class="text-caption text-grey-darken-1 mt-2">
                No proof files added yet. You can add up to 5 photos or videos.
              </p>
               <div v-if="v$.proof_files.$errors.length" class="text-caption text-red mt-2">
                {{ v$.proof_files.$errors.map(e => e.$message).join(', ') }}
              </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- NEW: DIALOG FOR UPLOAD OPTIONS (File or Camera) -->
    <v-dialog v-model="uploadProofOptionsDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Add Proof of Complaint</v-card-title>
        <v-card-text>
          <v-list density="comfortable">
            <v-list-item link @click="triggerFileInput">
              <template v-slot:prepend>
                <v-icon>mdi-file-upload-outline</v-icon>
              </template>
              <v-list-item-title>Upload from Device (Multiple)</v-list-item-title>
            </v-list-item>
            <v-list-item link @click="openCameraDialog" :disabled="form.proof_files.length >= 5">
              <template v-slot:prepend>
                <v-icon>mdi-camera-outline</v-icon>
              </template>
              <v-list-item-title>Capture Photo (Single)</v-list-item-title>
            </v-list-item>
          </v-list>
          <v-alert
            v-if="form.proof_files.length >= 5"
            type="warning"
            density="compact"
            class="mt-4"
            text="Maximum of 5 proof files already added. Please remove one to capture a new photo."
          ></v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="uploadProofOptionsDialog = false">Cancel</v-btn>
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
            <video ref="videoElement" autoplay playsinline class="camera-feed" v-show="!capturedImage"></video>
            <canvas ref="canvasElement" class="captured-preview" v-show="capturedImage"></canvas>

            <div v-if="!isCameraActive && !capturedImage" class="camera-status-overlay">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
              <p class="mt-2 text-white">Starting camera...</p>
              <p class="text-caption text-grey-lighten-1">
                If the camera doesn't start, please ensure you've granted permission.
              </p>
            </div>

            <div class="camera-controls" v-if="isCameraActive || capturedImage">
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
import { reactive, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp, useCookie } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

// Max file size for any individual proof file (image or video)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PROOF_FILES = 5; // Maximum number of proof files

const form = reactive({
  complainant_resident: null,
  complainant_address: '',
  contact_number: '',
  date_of_complaint: new Date().toISOString().split('T')[0],
  time_of_complaint: new Date().toTimeString().slice(0,5),
  category: '',
  person_complained_against_name: '',
  processed_by_personnel: '',
  status: 'New',
  notes_description: '',
  proof_files: [], // Array to hold File objects
});

const proofPreviewItems = ref([]); // Changed to store objects with url, type, and file

const complaintCategories = ref([
  'Theft / Robbery', 'Scam / Fraud', 'Physical Assault / Violence', 'Verbal Abuse / Threats',
  'Sexual Harassment / Abuse', 'Vandalism', 'Noise Disturbance', 'Illegal Parking / Obstruction',
  'Drunk and Disorderly Behavior', 'Curfew Violation / Minor Offenses', 'Illegal Gambling',
  'Animal Nuisance / Stray Animal Concern', 'Garbage / Sanitation Complaints',
  'Boundary Disputes / Trespassing', 'Barangay Staff / Official Misconduct', 'Missing Person', 'Others',
]);

const saving = ref(false);
const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

// NEW: Camera and Upload specific state
const uploadProofOptionsDialog = ref(false); // For the initial choice dialog
const cameraDialog = ref(false); // For the live camera feed dialog
const videoElement = ref(null); // Ref for the video element
const canvasElement = ref(null); // Ref for the canvas element
let mediaStream = null; // To hold the camera stream
const capturedImage = ref(''); // To hold the base64 of the captured image
const isCameraActive = ref(false); // To track if camera is actively streaming
const cameraPermissionError = ref(false); // To track if camera permission was denied

const fileInput = ref(null); // Ref for the hidden multiple file input for device upload


const rules = {
    complainant_resident: {
        required: helpers.withMessage('A complainant must be selected.', required),
        isActive: helpers.withMessage(
            (value) => {
                if (!value) return "Complainant not selected.";
                if (value.status === 'Pending') return "Resident account is pending approval and cannot file complaints.";
                if (value.status === 'Declined') return "Resident account has been declined and cannot file complaints.";
                if (value.status === 'Deactivated') return "Resident account has been permanently deactivated and cannot file complaints.";
                if (value.account_status !== 'Active') return "This resident's account is On Hold and cannot file complaints.";
                return true; // If all checks pass, it's active
            },
            (value) => {
                if (!value) return true; // Let 'required' handle null/undefined
                return value.status === 'Approved' && value.account_status === 'Active';
            }
        )
    },
    complainant_address: { required },
    contact_number: { required },
    date_of_complaint: { required },
    time_of_complaint: { required },
    person_complained_against_name: {},
    category: { required },
    processed_by_personnel: { required: helpers.withMessage('Processed by personnel is required.', required) },
    status: { required },
    notes_description: { required },
    // Validation rule for proof_files array
    proof_files: {
      maxLength: helpers.withMessage(`You can attach a maximum of ${MAX_PROOF_FILES} files.`, (value) => {
        return value.length <= MAX_PROOF_FILES;
      }),
      // No need for individual file size rule here, as it's handled during file addition
    },
};
const v$ = useVuelidate(rules, form);

onMounted(() => {
  const userData = useCookie('userData');
  if (userData.value) {
    form.processed_by_personnel = userData.value.name;
  } else {
    form.processed_by_personnel = 'Unknown User';
    console.warn('Could not retrieve user data from cookie.');
  }
});

onBeforeUnmount(() => {
  stopCameraStream(); // Ensure camera is stopped if component is unmounted
  // Revoke any remaining object URLs to prevent memory leaks
  proofPreviewItems.value.forEach(item => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
});

const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };

const searchResidentsAPI = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
        complainantSearchResults.value = [];
        return;
    }
    isLoadingComplainants.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching for complainant.`);
        
        complainantSearchResults.value = data.value?.residents.map(r => {
            const addressParts = [
                r.address_house_number,
                r.address_street,
                r.address_subdivision_zone
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ').trim();

            return {
                _id: r._id,
                name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                email: r.email,
                address: fullAddress || 'No address available',
                contact_number: r.contact_number,
                status: r.status, // ADDED: Project 'status'
                account_status: r.account_status
            }
        }) || [];
        
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        isLoadingComplainants.value = false;
    }
}, 500);

// --- Helper to convert a Data URL (Base64) to a File object ---
function dataURLtoFile(dataurl, filename, mimetype) {
    const arr = dataurl.split(',');
    const mime = mimetype || arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// --- Function to convert file to Base64 (used for sending to backend) ---
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Watch for changes in proof_files to update previews
watch(() => form.proof_files, (newFiles) => {
  // Revoke previous object URLs to prevent memory leaks
  proofPreviewItems.value.forEach(item => {
    if (item.url) { // Ensure url exists before revoking
      URL.revokeObjectURL(item.url);
    }
  });

  if (!newFiles || newFiles.length === 0) {
    proofPreviewItems.value = [];
    return;
  }

  // Use the actual form.proof_files for display
  proofPreviewItems.value = newFiles.map(file => {
    try {
      const url = URL.createObjectURL(file);
      return {
        url: url, // Create object URL for preview
        type: file.type, // Store file type to determine rendering
        file: file, // Keep a reference to the original file object
      };
    } catch (e) {
      console.error(`[Preview Error] Failed to create object URL for file '${file.name}':`, e);
      $toast.fire({ title: `Could not preview '${file.name}'.`, icon: 'error' });
      return { url: null, type: file.type, file: file, error: true }; // Mark as error
    }
  });
}, { deep: true });

// Handler for video error events
const handleVideoError = (fileName) => {
  console.error(`[Video Playback Error] Failed to load/play video: ${fileName}. Check network tab for blob: URL status.`);
  $toast.fire({ title: `Could not play video '${fileName}'. It might be corrupted or in an unsupported format.`, icon: 'error' });
};

watch(complainantSearchQuery, (newQuery) => { searchResidentsAPI(newQuery); });

watch(() => form.complainant_resident, (newResident) => {
    if (newResident && typeof newResident === 'object') {
        form.complainant_address = newResident.address;
        form.contact_number = newResident.contact_number;
    } else {
        form.complainant_address = '';
        form.contact_number = '';
    }
});

function removeProofFile(indexToRemove) {
  // Revoke the object URL for the file being removed to prevent memory leaks
  const itemToRemove = proofPreviewItems.value[indexToRemove];
  if (itemToRemove && itemToRemove.url) {
    URL.revokeObjectURL(itemToRemove.url);
  }
  form.proof_files.splice(indexToRemove, 1);
  v$.value.proof_files.$touch(); // Re-validate the proof_files array after removal
}


async function saveComplaint() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct all errors on the form.', icon: 'error' });
    return;
  }
  
  // Also perform a final check on individual file sizes, as the array rule doesn't cover this
  for (const file of form.proof_files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      $toast.fire({ title: `File "${file.name}" is too large! Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`, icon: 'error' });
      return;
    }
  }

  saving.value = true;

  try {
    // Convert all File objects in form.proof_files to Base64 for the payload
    const proofs_base64 = await Promise.all(
      form.proof_files.map(file => convertFileToBase64(file))
    );

    const payload = {
      complainant_resident_id: form.complainant_resident?._id,
      complainant_display_name: form.complainant_resident?.name,
      complainant_address: form.complainant_address,
      contact_number: form.contact_number,
      date_of_complaint: new Date(form.date_of_complaint).toISOString(),
      time_of_complaint: form.time_of_complaint,
      category: form.category,
      person_complained_against_name: form.person_complained_against_name,
      processed_by_personnel: form.processed_by_personnel,
      status: form.status,
      notes_description: form.notes_description,
      proofs_base64: proofs_base64, // Send Base64 array
    };
    
    // Send as JSON
    const { error } = await useMyFetch('/api/complaints', {
      method: 'POST',
      body: payload, // This will be sent as application/json
    });
    
    if (error.value) throw new Error(error.value.data?.message || 'Failed to submit complaint');

    $toast.fire({ title: 'Complaint submitted successfully!', icon: 'success' });
    router.push('/complaints');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}


// --- NEW UPLOAD/CAMERA FUNCTIONS ---
function triggerFileInput() {
  uploadProofOptionsDialog.value = false; // Close options dialog
  fileInput.value.click(); // Trigger the hidden multiple file input
}

async function handleProofFileChange(event) {
  uploadProofOptionsDialog.value = false; // Close options dialog
  const selectedFiles = Array.from(event.target.files);

  if (selectedFiles.length === 0) {
    // If no new files selected (e.g., user opened dialog and cancelled), do nothing
    return;
  }

  const newFilesToAdd = [];
  for (const file of selectedFiles) {
    if ((form.proof_files.length + newFilesToAdd.length) >= MAX_PROOF_FILES) {
      $toast.fire({ title: `Maximum of ${MAX_PROOF_FILES} files reached.`, icon: 'warning' });
      break; // Stop adding files if limit reached
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      $toast.fire({ title: `File "${file.name}" is too large! Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`, icon: 'warning' });
      continue; // Skip this file
    }
    
    newFilesToAdd.push(file);
  }

  if (newFilesToAdd.length > 0) {
    form.proof_files.push(...newFilesToAdd);
  }

  // Clear the file input value to allow selecting the same files again if needed
  if (fileInput.value) fileInput.value.value = '';
  v$.value.proof_files.$touch(); // Re-validate the proof_files array
}

function openCameraDialog() {
  if (form.proof_files.length >= MAX_PROOF_FILES) {
    $toast.fire({ title: `Maximum of ${MAX_PROOF_FILES} proof files already added.`, icon: 'warning' });
    uploadProofOptionsDialog.value = false; // Close options dialog
    return;
  }
  uploadProofOptionsDialog.value = false; // Close options dialog
  cameraDialog.value = true;
  startCamera();
}

async function startCamera() {
  isCameraActive.value = false;
  cameraPermissionError.value = false;
  capturedImage.value = '';
  stopCameraStream();

  await nextTick(); // Ensure video element is in DOM
  if (!videoElement.value) {
    console.error("Video element not found in DOM after nextTick.");
    $toast.fire({
        title: 'Camera initialization failed: video element not ready.',
        icon: 'error',
        timer: 3000
    });
    cameraDialog.value = false;
    return;
  }
  
  try {
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
  // Apply horizontal flip if the video element has it (from CSS)
  if (getComputedStyle(video).transform.includes('scaleX(-1)')) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.9); // Get base64 JPEG image
  stopCameraStream(); // Stop camera after taking photo
}

function retakePhoto() {
  capturedImage.value = '';
  startCamera(); // Restart camera for a new photo
}

function saveCapturedPhoto() {
  if (capturedImage.value) {
    if (form.proof_files.length >= MAX_PROOF_FILES) {
      $toast.fire({ title: `Maximum of ${MAX_PROOF_FILES} proof files already added.`, icon: 'warning' });
      cameraDialog.value = false; // Close camera dialog
      capturedImage.value = ''; // Clear image
      return;
    }

    const newFile = dataURLtoFile(capturedImage.value, `complaint_photo_${Date.now()}.jpeg`, 'image/jpeg');

    if (newFile.size > MAX_FILE_SIZE_BYTES) {
      $toast.fire({ title: `Captured photo is too large! Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`, icon: 'error' });
    } else {
      form.proof_files.push(newFile);
      $toast.fire({ title: 'Photo added to proofs!', icon: 'success' });
    }
    
    cameraDialog.value = false;
    capturedImage.value = ''; // Clear captured image from camera dialog state
    v$.value.proof_files.$touch(); // Re-validate the proof_files array
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
  opacity: 1;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}
/* Ensure previews maintain aspect ratio within their container */
.image-video-preview-wrapper {
  width: 100%;
  padding-top: 100%; /* 1:1 Aspect Ratio */
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0; /* Light background to make empty space visible */
  display: flex; /* For centering content in generic file case */
  justify-content: center;
  align-items: center;
}

.image-video-preview-wrapper .v-img,
.image-video-preview-wrapper video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* Default for both to ensure full content is visible. */
}

/* Styles for the remove file button */
.remove-file-btn {
  position: absolute;
  top: -8px; /* Adjust as needed */
  right: -8px; /* Adjust as needed */
  z-index: 10;
  background-color: white; /* Ensure it stands out */
  border-radius: 50%;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2);
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