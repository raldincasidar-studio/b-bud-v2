 <template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2">Loading Request...</p>
    </div>
    <div v-else-if="!request">
      <v-alert type="error" prominent border="start" text="Request not found or could not be loaded.">
        <template v-slot:append><v-btn to="/document-requests">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Document Request Details</h2>
          <p class="text-grey-darken-1">Reference #: {{ request.ref_no || requestId }}</p>
        </v-col>
        <v-col class="text-right">
          <v-chip :color="getStatusColor(request.document_status)" label size="large" class="font-weight-bold">{{ request.document_status }}</v-chip>
        </v-col>
      </v-row>

      <!-- ✨ STATUS TRACKER START ✨ -->
      <div class="status-tracker-container my-12">
        <div class="progress-bar-container">
            <div class="progress-bar-bg"></div>
            <div
                class="progress-bar-fg"
                :class="isDeclined ? 'bg-error' : 'bg-primary'"
                :style="{ width: progressWidth }"
            ></div>
        </div>
        <div class="steps-container">
            <div v-for="(step, index) in trackerSteps" :key="step.name" class="step-item">
                <div
                    class="step-circle"
                    :class="{
                        'completed': !isDeclined && index < activeStepIndex,
                        'current': !isDeclined && index === activeStepIndex,
                        'declined': isDeclined && index < activeStepIndex,
                        'failure-point': isDeclined && index === activeStepIndex
                    }"
                >
                    <v-icon size="large">
                        {{ getStepIcon(index, step.icon) }}
                    </v-icon>
                </div>
                <div
                    class="step-label mt-3"
                    :class="{ 'font-weight-bold text-primary': !isDeclined && index === activeStepIndex }"
                >
                    {{ step.name }}
                </div>
            </div>
        </div>
      </div>
      <!-- ✨ STATUS TRACKER END ✨ -->


      <!-- Request Details Card -->
      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Requestor</label>
              <v-text-field
                :model-value="requestorName"
                variant="outlined"
                readonly
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Document Type</label>
              <v-text-field :model-value="request.request_type" variant="outlined" readonly></v-text-field>
            </v-col>
            <v-col cols="12">
              <label class="v-label mb-1">Purpose of Request</label>
              <v-textarea
                :model-value="request.purpose"
                variant="outlined"
                readonly
                rows="3"
              ></v-textarea>
            </v-col>
          </v-row>
          <v-divider class="my-6"></v-divider>

          <!-- Dynamic Details Section (Read-Only) -->
          <div v-if="request.request_type && request.details">
            <h3 class="text-h6 mb-4">{{ request.request_type }} - Details</h3>
            <div v-if="request.request_type === 'Certificate of Cohabitation'">
              <v-row>
                <v-col cols="12" md="6"><v-text-field :model-value="request.details.male_partner_name" label="Full Name of Male Partner" readonly variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field :model-value="request.details.male_partner_birthdate" label="Birthdate of Male Partner" type="date" readonly variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field :model-value="request.details.female_partner_name" label="Full Name of Female Partner" readonly variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field :model-value="request.details.female_partner_birthdate" label="Birthdate of Female Partner" type="date" readonly variant="outlined"></v-text-field></v-col>
                <v-col cols="12" md="6"><v-text-field :model-value="request.details.year_started_cohabiting" label="Year Started Living Together" type="number" readonly variant="outlined"></v-text-field></v-col>
              </v-row>
            </div>
            <!-- Add other read-only document detail sections here as needed -->
          </div>
          
          <!-- NEW: Display reason for decline/invalidation -->
          <v-alert
            v-if="isDeclined && request.status_reason"
            type="error"
            variant="tonal"
            border="start"
            class="my-6"
            icon="mdi-information-outline"
            density="compact"
          >
            <template v-slot:title><strong class="text-error">Reason for Decline / Invalidation</strong></template>
            {{ request.status_reason }}
          </v-alert>

          <v-divider class="my-6"></v-divider>
          <!-- Timestamps -->
          <v-row>
            <v-col cols="12" sm="6">
              <p class="text-caption text-grey">Date Requested:</p>
              <p class="font-weight-medium">{{ formatTimestamp(request.created_at) }}</p>
            </v-col>
            <v-col cols="12" sm="6">
              <p class="text-caption text-grey">Last Updated:</p>
              <p class="font-weight-medium">{{ formatTimestamp(request.updated_at) }}</p>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- ATTACHED FILES -->
      <v-card class="mt-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Files Attached</v-card-title>
        <v-card-text v-if="['Ready for Pickup', 'Released'].includes(request.document_status)">
            <v-row>
                <v-col cols="12" sm="12" md="4" lg="4">
                    <v-card class="pa-4 py-10" border flat v-ripple @click="generateAndSetToPickup">
                        <v-card-title class="text-center">
                            <v-icon size="xxx-large" color="primary">mdi-file-pdf-box</v-icon>
                        </v-card-title>
                        <v-card-title>{{ request.request_type }}</v-card-title>
                        <v-card-subtitle>View File</v-card-subtitle>
                    </v-card>
                </v-col>
            </v-row>
        </v-card-text>
        <v-card-text v-else class="py-5">
          <p class="text-grey-darken-1">No files generated yet. Please generate the file and it will be automatically saved here once generated.</p>
        </v-card-text>
      </v-card>
      

      <!-- ACTION CARD - WORKFLOW LOGIC -->
      <v-card class="mt-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Actions</v-card-title>

        <!-- State: Auto-Processing -->
        <div v-if="isAutoProcessing" class="text-center pa-6">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <p class="mt-3 text-grey-darken-1">Moving request to "Processing"...</p>
        </div>

        <!-- UPDATED: State: Processing -> Approve/Decline -->
        <div v-else-if="request.document_status === 'Processing'">
          <v-card-text>Review the information above. Once verified, you can approve the request.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="success" @click="approveRequest" :loading="isActing" prepend-icon="mdi-check-circle-outline">Approve</v-btn>
            <v-btn size="large" color="error" variant="outlined" @click="declineDialog = true" :loading="isActing" prepend-icon="mdi-close-circle-outline">Decline</v-btn>
          </v-card-actions>
        </div>

        <!-- State: Approved -> Generate & Set to Pickup -->
        <div v-else-if="request.document_status === 'Approved'">
          <v-card-text>The request is approved. Generate the document to prepare it for pickup.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="primary" @click="generateAndSetToPickup" :loading="isActing" prepend-icon="mdi-printer-outline">Generate & Set to "Ready for Pickup"</v-btn>
          </v-card-actions>
        </div>
        
        <!-- State: Ready for Pickup -> Release Document -->
        <div v-else-if="request.document_status === 'Ready for Pickup'">
          <v-card-text>
            <p class="mb-4">The document is ready. To release it to the requestor, please upload a proof of release (e.g., a photo of the signed acknowledgement receipt).</p>
            <v-file-input
              v-model="proofOfReleaseFile"
              label="Upload Proof of Release Photo"
              accept="image/*"
              variant="outlined"
              prepend-icon="mdi-camera"
              :disabled="isActing"
              clearable
              show-size
            ></v-file-input>
            <v-img
              v-if="proofOfReleaseBase64"
              :src="proofOfReleaseBase64"
              max-height="300"
              contain
              class="mt-4 border rounded"
              alt="Proof of release preview"
            ></v-img>
          </v-card-text>
          <v-card-actions class="pa-4">
            <v-btn 
              size="large" 
              color="success" 
              @click="releaseRequest" 
              :loading="isActing" 
              :disabled="!proofOfReleaseBase64"
              prepend-icon="mdi-check-decagram-outline"
            >
              Release Document
            </v-btn>
          </v-card-actions>
        </div>

        <!-- State: Released -> Show Proof of Release -->
        <div v-else-if="request.document_status === 'Released'">
          <v-card-text>
              <p>This document was successfully released on <strong>{{ formatTimestamp(request.released_at) }}</strong>.</p>
              <div v-if="request.proof_of_release_photo" class="mt-4">
                  <h4 class="mb-2 text-subtitle-1 font-weight-medium">Proof of Release</h4>
                  <v-img
                      :src="request.proof_of_release_photo"
                      max-height="400"
                      contain
                      class="border rounded cursor-pointer"
                      alt="Proof of release photo"
                      @click="openProofViewer(request.proof_of_release_photo)"
                  ></v-img>
              </div>
          </v-card-text>
        </div>
        
        <!-- Fallback State -->
        <div v-else>
           <v-card-text>No further actions are required for this request.</v-card-text>
        </div>
      </v-card>
    </div>

    <!-- DIALOG: PROOF VIEWER WITH ZOOM -->
    <v-dialog v-model="proofViewerDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-toolbar-title>Proof of Release</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="proofViewerDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text
          class="d-flex justify-center align-center"
          style="background-color: rgba(0,0,0,0.8); position: relative; overflow: auto;"
        >
          <v-img
            :src="selectedProofPhoto"
            contain
            max-height="90vh"
            max-width="90vw"
            :style="imageStyle"
          ></v-img>
          <div class="zoom-controls">
            <v-btn icon="mdi-magnify-minus-outline" @click="zoomOut" class="mx-1" title="Zoom Out"></v-btn>
            <v-btn icon="mdi-fit-to-screen-outline" @click="resetZoom" class="mx-1" title="Reset Zoom"></v-btn>
            <v-btn icon="mdi-magnify-plus-outline" @click="zoomIn" class="mx-1" title="Zoom In"></v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- NEW: DIALOG FOR DECLINE WITH REASON -->
    <v-dialog v-model="declineDialog" persistent max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Decline Request</v-card-title>
        <v-card-text>
          <p class="mb-4">Please provide a reason for declining this document request. This reason will be visible to the user and recorded.</p>
          <v-textarea
            v-model="declineReason"
            label="Reason for Decline"
            variant="outlined"
            rows="3"
            counter
            maxlength="250"
            :rules="[v => !!v || 'Reason is required.']"
            autofocus
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="declineDialog = false">Cancel</v-btn>
          <v-btn color="error" :disabled="!declineReason" :loading="isActing" @click="confirmDecline">Confirm Decline</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const requestId = route.params.id;

// --- STATE ---
const request = ref(null);
const loading = ref(true);
const isActing = ref(false);
const isAutoProcessing = ref(false);
const proofOfReleaseFile = ref(null);
const proofOfReleaseBase64 = ref('');

// NEW: State for decline dialog
const declineDialog = ref(false);
const declineReason = ref('');

// --- STATUS TRACKER CONFIGURATION ---
const trackerSteps = ref([
    { name: 'Pending', icon: 'mdi-file-clock-outline' },
    { name: 'Processing', icon: 'mdi-cogs' },
    { name: 'Approved', icon: 'mdi-thumb-up-outline' },
    { name: 'Ready for Pickup', icon: 'mdi-package-variant-closed' },
    { name: 'Released', icon: 'mdi-handshake-outline' }
]);
const statusItems = [
  'Pending',
  'Follow up',
  'Processing',
  'Approved',
  'Ready for Pickup',
  'Released',
  'Declined'
];

// --- COMPUTED PROPERTIES ---
const requestorName = computed(() => {
  if (request.value?.requestor_details) {
    return `${request.value.requestor_details.first_name} ${request.value.requestor_details.last_name}`;
  }
  return 'Loading...';
});

const isDeclined = computed(() => request.value?.document_status === 'Declined');

const statusOrder = ['Pending', 'Follow up', 'Processing', 'Approved', 'Ready for Pickup', 'Released', 'Declined'];

const activeStepIndex = computed(() => {
  if (!request.value) return -1;
  if (isDeclined.value) return statusOrder.indexOf('Processing');
  return statusOrder.indexOf(request.value.document_status);
});

const progressWidth = computed(() => {
  if (activeStepIndex.value <= 0) return '0%';
  const percentage = (activeStepIndex.value / (trackerSteps.value.length - 1)) * 100;
  return `${percentage}%`;
});

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => {
  await fetchRequest();
});

async function fetchRequest(showLoading = true) {
    if (showLoading) loading.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/document-requests/${requestId}`);
        if (error.value || !data.value?.request) {
            throw new Error(`Request '${requestId}' not found.`);
        }
        request.value = data.value.request;

        if (request.value.document_status === 'Pending') {
            isAutoProcessing.value = true;
            try {
                await _updateStatusOnBackend('Processing');
                await fetchRequest(false);
            } catch (processError) {
                console.error("Failed to auto-update status to 'Processing':", processError);
                $toast.fire({ title: 'Could not auto-start processing.', icon: 'warning', timer: 3000 });
            } finally {
                isAutoProcessing.value = false;
            }
        }
    } catch (e) {
      $toast.fire({ title: e.message, icon: 'error' });
    } finally {
      if (showLoading) loading.value = false;
    }
}

// --- FILE HANDLING ---
watch(proofOfReleaseFile, (file) => {
  if (!file) {
    proofOfReleaseBase64.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    $toast.fire({ title: 'File size should not exceed 5MB.', icon: 'warning' });
    proofOfReleaseFile.value = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => { proofOfReleaseBase64.value = e.target.result; };
  reader.onerror = (e) => {
    console.error("FileReader error:", e);
    $toast.fire({ title: 'Could not read the file.', icon: 'error' });
    proofOfReleaseBase64.value = '';
  };
  reader.readAsDataURL(file);
});

// --- ACTION HANDLERS ---
// UPDATED: Centralized function to update status, now accepts a body
async function _updateStatusOnBackend(newStatus, body = {}) {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/status`, {
      method: 'PATCH',
      body: { status: newStatus, ...body }
    });
    if (error.value) throw new Error(error.value.data?.error || `Failed to update status.`);
    return data.value;
}

async function approveRequest() {
  isActing.value = true;
  try {
    const response = await _updateStatusOnBackend('Approved');
    $toast.fire({ title: response.message, icon: 'success' });
    await fetchRequest(false);
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

// NEW: Function to handle the decline API call with reason
async function confirmDecline() {
    if (!declineReason.value) {
        $toast.fire({ title: 'A reason is required to decline.', icon: 'warning' });
        return;
    }
    isActing.value = true;
    try {
        const response = await _updateStatusOnBackend('Declined', { reason: declineReason.value });
        $toast.fire({ title: response.message || 'Request declined.', icon: 'info' });
        declineDialog.value = false;
        await fetchRequest(false); // Refresh data from server
    } catch (e) { 
        $toast.fire({ title: e.message, icon: 'error' });
    } finally { 
        isActing.value = false; 
    }
}

async function generateAndSetToPickup() {
  isActing.value = true;
  try {
    // ONLY update status to 'Ready for Pickup' if it's currently 'Approved'.
    // If it's already 'Ready for Pickup' or 'Released', just proceed to download
    // without changing the status.
    if (request.value.document_status === 'Approved') { // <-- MODIFIED THIS LINE
      const response = await _updateStatusOnBackend('Ready for Pickup');
      $toast.fire({ title: 'Status set to "Ready for Pickup"!', icon: 'success' });
      await fetchRequest(false); // Refresh data to update UI with new status
    }

    // Always attempt to open the document for viewing/downloading
    const refNo = request.value.ref_no;
    const baseUrl = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001';
    const downloadUrl = `${baseUrl}/api/document-requests/${refNo}/generate`;

    const newTab = window.open(downloadUrl, '_blank');
    if (!newTab) {
      $toast.fire({ title: 'Please allow popups to download the document.', icon: 'warning' });
    }
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}


async function releaseRequest() {
  if (!proofOfReleaseBase64.value) {
    $toast.fire({ title: 'Please upload a proof of release photo.', icon: 'warning' });
    return;
  }
  isActing.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/release`, {
      method: 'PATCH',
      body: { proof_of_release: proofOfReleaseBase64.value }
    });
    if (error.value) throw new Error(error.value.data?.error || 'Failed to release the document.');
    $toast.fire({ title: data.value.message || 'Document Released!', icon: 'success' });
    await fetchRequest(false);
    proofOfReleaseBase64.value = '';
    proofOfReleaseFile.value = null;
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' });
  } finally { isActing.value = false; }
}


// --- HELPER FUNCTIONS ---
function getStepIcon(index, defaultIcon) {
    if (isDeclined.value) {
        if (index < activeStepIndex.value) return 'mdi-check';
        if (index === activeStepIndex.value) return 'mdi-close';
        return defaultIcon;
    }
    if (index < activeStepIndex.value) {
        return 'mdi-check';
    }
    return defaultIcon;
}

const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1',
    "Processing": 'blue-darken-1',
    "Approved": 'cyan-darken-1',
    "Ready for Pickup": 'green-darken-1',
    "Released": 'success',
    "Declined": 'red-darken-2'
  }[status] || 'grey');

const formatTimestamp = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return dateString; }
};

// --- ZOOM VIEWER LOGIC ---
const proofViewerDialog = ref(false);
const selectedProofPhoto = ref('');
const zoomLevel = ref(1);

const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value})`,
  transition: 'transform 0.2s ease-out'
}));

const openProofViewer = (url) => {
  selectedProofPhoto.value = url;
  zoomLevel.value = 1; 
  proofViewerDialog.value = true;
};

const zoomIn = () => { zoomLevel.value += 0.2; };
const zoomOut = () => { zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.2); };
const resetZoom = () => { zoomLevel.value = 1; };
</script>

<style scoped>
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
  width: 90%;
  transform: translateY(-50%);
}
.progress-bar-bg {
  width: 90%;
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
  width: 100px;
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
.step-circle.declined {
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
.cursor-pointer {
  cursor: pointer;
}
.zoom-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(40, 40, 40, 0.75);
  padding: 8px;
  border-radius: 24px;
  z-index: 10;
  display: flex;
  gap: 8px;
}
</style>