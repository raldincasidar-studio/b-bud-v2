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
            <!-- REVISION: This section is now fixed -->
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Requestor</label>
              <v-text-field
                :model-value="requestorName"
                variant="outlined"
                readonly
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Purpose of Request</label>
              <v-text-field :model-value="request.purpose" variant="outlined" readonly></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Document Type</label>
              <v-text-field :model-value="request.request_type" variant="outlined" readonly></v-text-field>
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

        <div v-if="isAutoProcessing" class="text-center pa-6">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <p class="mt-3 text-grey-darken-1">Moving request to "Processing"...</p>
        </div>

        <div v-else-if="request.document_status === 'Processing'">
          <v-card-text>Review the information above. Once verified, you can approve the request.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="success" @click="approveRequest" :loading="isActing" prepend-icon="mdi-check-circle-outline">Approve</v-btn>
            <v-btn size="large" color="error" variant="outlined" @click="declineRequest" :loading="isActing" prepend-icon="mdi-close-circle-outline">Decline</v-btn>
          </v-card-actions>
        </div>

        <div v-else-if="request.document_status === 'Approved' || request.document_status === 'Ready for Pickup'">
          <v-card-text>The request is approved. Generate the document for printing and pickup.</v-card-text>
          <v-card-actions class="pa-4">
            <v-btn size="large" color="primary" @click="generateAndSetToPickup" :loading="isActing" prepend-icon="mdi-printer-outline">Generate & Set to "Ready for Pickup"</v-btn>
          </v-card-actions>
        </div>

        <div v-else-if="request.document_status === 'Ready for Pickup'">
          <v-card-text class="d-flex align-center">
            <v-icon color="teal" class="mr-2">mdi-package-variant-closed</v-icon>
            Document is ready for the resident to claim.
          </v-card-text>
        </div>
        
        <div v-else>
           <v-card-text>No further actions are required for this request.</v-card-text>
        </div>
      </v-card>
    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
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

// --- COMPUTED PROPERTIES ---
// REVISION: This computed property solves the display issue.
const requestorName = computed(() => {
  console.log(request.value);
  if (request.value && request.value.requestor_details) {
    return `${request.value.requestor_details.first_name} ${request.value.requestor_details.last_name}`;
  }

  return '...';
});

// --- LIFECYCLE & DATA FETCHING ---
onMounted(async () => { await fetchRequest(); });

async function fetchRequest(showLoading = true) {
    if(showLoading) loading.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/document-requests/${requestId}`);
        if (error.value || !data.value?.request) throw new Error('Request not found.');
        
        request.value = data.value.request;

        if (request.value.document_status === 'Pending') {
            isAutoProcessing.value = true;
            const { data: processedData, error: processError } = await useMyFetch(`/api/document-requests/${requestId}/process`, { method: 'PATCH' });
            if (processError.value) throw new Error('Could not auto-update status to Processing.');
            request.value = processedData.value.request;

            
        }
        
    } catch (e) { 
      $toast.fire({ title: e.message, icon: 'error' });
    } finally { 
      loading.value = false;
      isAutoProcessing.value = false;
    }
}

// --- ACTION HANDLERS ---
async function approveRequest() {
  isActing.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/approve`, { method: 'PATCH' });
    if (error.value) throw new Error('Failed to approve request.');
    request.value = data.value.request;
    $toast.fire({ title: 'Request Approved!', icon: 'success' });
  } catch(e) { 
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

async function generateAndSetToPickup() {
  isActing.value = true;
  try {
    if (request.value.document_status !== 'Ready for Pickup') {
      const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/generate`, { method: 'PATCH' });
      if (error.value) throw new Error('Failed to update status to "Ready for Pickup".');
      request.value = data.value.request;
  
    }
    const baseURL = useRuntimeConfig().public.apiBase || 'http://localhost:3001';
    window.open(`${baseURL}/api/document-requests/${requestId}/generate`, '_blank');

    $toast.fire({ title: 'Document is now Ready for Pickup!', icon: 'success' });
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

async function declineRequest() {
    isActing.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/document-requests/${requestId}/decline`, { method: 'PATCH', body: { reason: 'N/A' } });
        if (error.value) throw new Error('Failed to decline request.');
        request.value = data.value.request;
        $toast.fire({ title: 'Request Declined', icon: 'info' });
    } catch(e) {
        $toast.fire({ title: e.message, icon: 'error' });
    } finally {
        isActing.value = false;
    }
}

// --- HELPER FUNCTIONS ---
const getStatusColor = (status) => ({
    "Pending": 'orange-darken-1', "Processing": 'blue-darken-1', "Approved": 'teal-darken-1',
    "Ready for Pickup": 'green-darken-1', "Released": 'success', "Declined": 'red-darken-2'
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