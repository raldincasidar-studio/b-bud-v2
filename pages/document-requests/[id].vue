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
        <div v-else-if="request.document_status === 'Approved' || request.document_status === 'Ready for Pickup'">
          <v-card-text>The request is approved. Generate the document for printing and pickup.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="primary" @click="generateAndSetToPickup" :loading="isActing" prepend-icon="mdi-printer-outline">Generate & Set to "Ready for Pickup"</v-btn>
          </v-card-actions>
        </div>
        
        <!-- ✨ NEW: State: Ready for Pickup -> Release Document -->
        <div v-if="request.document_status === 'Ready for Pickup'">
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

        <!-- ✨ NEW: State: Released -> Show Proof of Release -->
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
const requestId = route.params.id; // Can be ObjectId or the new ref_no

// --- STATE ---
const request = ref(null);
const loading = ref(true);
const isActing = ref(false); // For user-initiated actions
const isAutoProcessing = ref(false); // For the initial status change

// State for Release Action
const proofOfReleaseFile = ref([]); // v-file-input model
const proofOfReleaseBase64 = ref('');

// --- COMPUTED PROPERTIES ---
const requestorName = computed(() => {
  if (request.value?.requestor_details) {
    return `${request.value.requestor_details.first_name} ${request.value.requestor_details.last_name}`;
  }
  return 'Loading...';
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

        // Auto-update status from 'Pending' to 'Processing'
        if (request.value.document_status === 'Pending') {
            isAutoProcessing.value = true;
            try {
                // This silently updates the status in the background on page load
                await _updateStatusOnBackend('Processing');
                await fetchRequest(false); // Refetch to display the new 'Processing' status
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
    proofOfReleaseBase64.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    $toast.fire({ title: 'File size should not exceed 5MB.', icon: 'warning' });
    proofOfReleaseFile.value = [];
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    proofOfReleaseBase64.value = e.target.result;
  };
  reader.onerror = (e) => {
    console.error("FileReader error:", e);
    $toast.fire({ title: 'Could not read the file.', icon: 'error' });
    proofOfReleaseBase64.value = '';
  };
  reader.readAsDataURL(file);
});


// --- ACTION HANDLERS ---

// Internal helper to call the generic status update endpoint
async function _updateStatusOnBackend(newStatus) {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });
    if (error.value) {
      throw new Error(error.value.data?.error || `Failed to update status.`);
    }
    return data.value;
}

// Simple wrapper to approve the request (moves to 'Ready for Pickup')
async function approveRequest() {
  isActing.value = true;
  try {
    const response = await _updateStatusOnBackend('Ready for Pickup');
    $toast.fire({ title: response.message, icon: 'success' });
    await fetchRequest(false);
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

// UPDATED: Simple wrapper to decline the request
async function declineRequest() {
    isActing.value = true;
    try {
        // Use "Declined" instead of "Denied"
        const response = await _updateStatusOnBackend('Declined');
        $toast.fire({ title: response.message, icon: 'info' });
        await fetchRequest(false);
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        isActing.value = false;
    }
}

// Updates status and then opens the generation link
async function generateAndSetToPickup() {
  isActing.value = true;
  try {
    if (request.value.document_status !== 'Ready for Pickup') {
      const response = await _updateStatusOnBackend('Ready for Pickup');
      $toast.fire({ title: response.message, icon: 'success' });
      await fetchRequest(false);
    }

    const refNo = request.value.ref_no;
    const baseUrl = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001';
    window.open(`${baseUrl}/api/document-requests/${refNo}/generate`, '_blank');

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

// Handles releasing the document with proof
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

    if (error.value) {
      throw new Error(error.value.data?.error || 'Failed to release the document.');
    }

    $toast.fire({ title: data.value.message || 'Document Released!', icon: 'success' });
    await fetchRequest(false);

    proofOfReleaseBase64.value = '';
    proofOfReleaseFile.value = [];

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

// --- HELPER FUNCTIONS ---
// UPDATED: Changed "Denied" to "Declined"
const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1', 
    "Processing": 'blue-darken-1', 
    "Ready for Pickup": 'green-darken-1',
    "Released": 'success', 
    "Declined": 'red-darken-2' // Changed from Denied
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