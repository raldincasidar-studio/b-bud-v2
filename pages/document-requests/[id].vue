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
          <p class="text-grey-darken-1">Reference #: {{ requestId }}</p>
        </v-col>
        <v-col class="text-right">
          <v-chip :color="getStatusColor(request.document_status)" label size="large" class="font-weight-bold">{{ request.document_status }}</v-chip>
        </v-col>
      </v-row>

      <!-- ✨ UPDATED STATUS TRACKER START ✨ -->
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
                    <!-- Icon color is now controlled by CSS -->
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
      <!-- ✨ UPDATED STATUS TRACKER END ✨ -->


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
            <!-- Add other read-only document detail sections here... -->
          </div>
          
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

      <!-- ACTION CARD - WORKFLOW LOGIC -->
      <v-card class="mt-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Actions</v-card-title>

        <!-- State: Auto-Processing -->
        <div v-if="isAutoProcessing" class="text-center pa-6">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <p class="mt-3 text-grey-darken-1">Moving request to "Processing"...</p>
        </div>

        <!-- State: Processing -> Approve/Decline -->
        <div v-else-if="request.document_status === 'Processing'">
          <v-card-text>Review the information above. Once verified, you can approve the request.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="success" @click="approveRequest" :loading="isActing" prepend-icon="mdi-check-circle-outline">Approve</v-btn>
            <v-btn size="large" color="error" variant="outlined" @click="declineRequest" :loading="isActing" prepend-icon="mdi-close-circle-outline">Decline</v-btn>
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
                      class="border rounded"
                      alt="Proof of release photo"
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
const proofOfReleaseFile = ref([]);
const proofOfReleaseBase64 = ref('');

// --- STATUS TRACKER CONFIGURATION ---
const trackerSteps = ref([
    { name: 'Pending', icon: 'mdi-file-clock-outline' },
    { name: 'Processing', icon: 'mdi-cogs' },
    { name: 'Approved', icon: 'mdi-thumb-up-outline' },
    { name: 'Ready for Pickup', icon: 'mdi-package-variant-closed' },
    { name: 'Released', icon: 'mdi-handshake-outline' }
]);
const statusOrder = ['Pending', 'Processing', 'Approved', 'Ready for Pickup', 'Released'];

// --- COMPUTED PROPERTIES ---
const requestorName = computed(() => {
  if (request.value?.requestor_details) {
    return `${request.value.requestor_details.first_name} ${request.value.requestor_details.last_name}`;
  }
  return 'Loading...';
});

// --- TRACKER COMPUTED PROPS ---
const isDeclined = computed(() => request.value?.document_status === 'Declined');

const activeStepIndex = computed(() => {
  if (!request.value) return -1;
  // If declined, the failure point is the 'Processing' step
  if (isDeclined.value) return statusOrder.indexOf('Processing');
  return statusOrder.indexOf(request.value.document_status);
});

const progressWidth = computed(() => {
  if (activeStepIndex.value <= 0) return '0%';
  // The progress bar connects the centers of the circles
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
watch(proofOfReleaseFile, (newFiles) => {
  const file = newFiles[0];
  if (!file) {
    proofOfReleaseBase64.value = ''; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    $toast.fire({ title: 'File size should not exceed 5MB.', icon: 'warning' });
    proofOfReleaseFile.value = []; return;
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
async function _updateStatusOnBackend(newStatus, body = {}) {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/status`, {
      method: 'PATCH',
      body: { status: newStatus, ...body }
    });
    if (error.value) throw new Error(error.value.data?.error || `Failed to update status.`);
    return data.value;
}

// Correctly moves the status to 'Approved'
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

async function declineRequest() {
    isActing.value = true;
    try {
        const response = await _updateStatusOnBackend('Declined');
        $toast.fire({ title: response.message, icon: 'info' });
        await fetchRequest(false);
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' });
    } finally { isActing.value = false; }
}

async function generateAndSetToPickup() {
  isActing.value = true;
  try {
    if (request.value.document_status !== 'Ready for Pickup') {
      const response = await _updateStatusOnBackend('Ready for Pickup');
      $toast.fire({ title: 'Status set to "Ready for Pickup"!', icon: 'success' });
      await fetchRequest(false);
    }

    // NOTE TO AI: PLEASE DO NOT CHANGE HOW DHE `baseUrl` IS DEFINED HERE
    const refNo = request.value.ref_no;
    const baseUrl = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001';
    const downloadUrl = `${baseUrl}/api/document-requests/${refNo}/generate`;

    const newTab = window.open(downloadUrl, '_blank');
    if (!newTab) {
      $toast.fire({ title: 'Please allow popups to download the document.', icon: 'warning' });
    }
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' });
  } finally { isActing.value = false; }
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
    proofOfReleaseFile.value = [];
  } catch (e) { $toast.fire({ title: e.message, icon: 'error' });
  } finally { isActing.value = false; }
}


// --- HELPER FUNCTIONS ---
// Returns correct icon based on state
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

// Includes color for 'Approved'
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
  top: 20px; /* Vertically center with the circles */
  left: 0;
  right: 0;
  width: 100%;
  padding: 0 40px; /* Align with centers of first/last circle */
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
  background-color: #e0e0e0; /* A light grey color */
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

/* Default state for future steps (hollow grey) */
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
  color: #9e9e9e; /* Darker grey for icon */
  transition: color 0.4s;
}

/* Current step (hollow blue) */
.step-circle.current {
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.current .v-icon {
  color: rgb(var(--v-theme-primary));
}

/* Completed steps (solid blue) */
.step-circle.completed {
  background-color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.completed .v-icon {
  color: white;
}

/* Declined state (solid red) */
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
  color: #757575; /* Standard grey for labels */
  transition: color 0.4s, font-weight 0.4s;
}
</style>