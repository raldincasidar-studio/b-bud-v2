<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col><h2>New Document Request</h2></v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveRequest" prepend-icon="mdi-content-save" variant="tonal" :loading="saving" size="large">
          Submit Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-file-document-plus-outline" title="Request Details">
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="request.request_type" label="Request Type (e.g., Barangay Clearance)" :rules="[rules.required]" variant="outlined" density="compact" required></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="request.date_of_request" label="Date of Request" type="date" :rules="[rules.required]" variant="outlined" density="compact" required></v-text-field>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>
          <h3 class="text-subtitle-1 mb-2">Requestor Information</h3>
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Full Name of Requestor <span class="text-red">*</span></label>
              <v-text-field
                v-model="requestorSearchQuery"
                label="Search Requestor (Resident)..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined" density="compact"
                clearable @click:clear="clearRequestorSelection"
                :loading="isLoadingRequestors"
                :rules="[rules.requestorSelected]"
                :hint="selectedRequestorName ? `Selected: ${selectedRequestorName}` : 'Type to search resident'"
                persistent-hint
              ></v-text-field>
              <v-list v-if="requestorSearchResults.length > 0 && requestorSearchQuery" density="compact" class="elevation-2 search-results-list">
                <v-list-item
                  v-for="resident in requestorSearchResults" :key="resident._id" @click="selectRequestor(resident)"
                  :title="`${resident.first_name} ${resident.middle_name || ''} ${resident.last_name}`"
                ><v-list-item-subtitle>{{ resident.email || 'No email' }}</v-list-item-subtitle></v-list-item>
              </v-list>
            </v-col>
             <v-col cols="12" md="6">
                <v-text-field v-model="request.requestor_address" label="Requestor Address" :rules="[rules.required]" variant="outlined" density="compact" required placeholder="Auto-fills or enter manually"></v-text-field>
            </v-col>
          </v-row>
          <v-row>
             <v-col cols="12" md="6">
                <v-text-field v-model="request.requestor_contact_number" label="Requestor Contact Number" :rules="[rules.required, rules.contactFormat]" variant="outlined" density="compact" required placeholder="Auto-fills or enter manually" type="tel"></v-text-field>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>
          <h3 class="text-subtitle-1 mb-2">Request Processing Information</h3>
           <v-row>
            <v-col cols="12">
              <v-textarea v-model="request.purpose_of_request" label="Purpose of Request" :rules="[rules.required]" variant="outlined" rows="3" auto-grow required></v-textarea>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Requested By (Personnel - Optional)</label>
               <v-text-field
                v-model="processedBySearchQuery"
                label="Search Personnel (Resident/Admin)..."
                prepend-inner-icon="mdi-account-search-outline"
                variant="outlined" density="compact"
                clearable @click:clear="clearProcessedBySelection"
                :loading="isLoadingProcessedBy"
                :hint="selectedProcessedByName ? `Selected: ${selectedProcessedByName}` : 'Search or leave blank'"
                persistent-hint
              ></v-text-field>
              <v-list v-if="processedBySearchResults.length > 0 && processedBySearchQuery" density="compact" class="elevation-2 search-results-list">
                <v-list-item
                  v-for="resident in processedBySearchResults" :key="resident._id" @click="selectProcessedBy(resident)"
                  :title="`${resident.first_name} ${resident.middle_name || ''} ${resident.last_name}`"
                ><v-list-item-subtitle>{{ resident.email || 'No email' }}</v-list-item-subtitle></v-list-item>
              </v-list>
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="request.document_status" label="Initial Document Status" :items="statusOptions" :rules="[rules.required]" variant="outlined" density="compact" required></v-select>
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
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null);

const request = ref({
  request_type: '',
  requestor_address: '',
  requestor_contact_number: '',
  date_of_request: new Date().toISOString().split('T')[0],
  purpose_of_request: '',
  document_status: 'Pending',
});
const saving = ref(false);

// Requestor search state
const requestorSearchQuery = ref(''); const requestorSearchResults = ref([]); const isLoadingRequestors = ref(false);
const selectedRequestorId = ref(null); const selectedRequestorName = ref('');

// Requested By (Personnel) search state
const processedBySearchQuery = ref(''); const processedBySearchResults = ref([]); const isLoadingProcessedBy = ref(false);
const selectedProcessedById = ref(null); const selectedProcessedByName = ref('');

const statusOptions = ['Pending', 'Processing', 'Ready for Pickup', 'Released', 'Denied', 'Cancelled'];
const rules = {
  required: value => !!value || 'This field is required.',
  requestorSelected: value => !!selectedRequestorId.value || 'A requestor (resident) must be selected.',
  contactFormat: value => (/^\+?[0-9\s-]{7,15}$/.test(value) || value === '') || 'Invalid contact number.',
};

function debounce(fn,delay){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),delay);};}
const searchResidentsAPI = async (q, type) => {
  const tq=typeof q==='string'?q.trim():''; if(tq.length<2){if(type==='requestor')requestorSearchResults.value=[];if(type==='processedBy')processedBySearchResults.value=[];return;}
  if(type==='requestor')isLoadingRequestors.value=true;if(type==='processedBy')isLoadingProcessedBy.value=true;
  try{const{data,error}=await useMyFetch('/api/residents/search',{query:{q:tq}});
  if(error.value){console.error(error.value)}else{if(type==='requestor')requestorSearchResults.value=data.value?.residents||[];if(type==='processedBy')processedBySearchResults.value=data.value?.residents||[];}}
  catch(e){console.error(e)}finally{if(type==='requestor')isLoadingRequestors.value=false;if(type==='processedBy')isLoadingProcessedBy.value=false;}};

// Requestor Search
const debouncedRequestorSearch=debounce((q)=>searchResidentsAPI(q,'requestor'),500);
watch(requestorSearchQuery,(nq)=>{if(nq===selectedRequestorName.value&&selectedRequestorId.value)return;if(!nq||nq.trim()===''){requestorSearchResults.value=[];clearRequestorSelection(false);}else{debouncedRequestorSearch(nq);}});
const selectRequestor=(res)=>{selectedRequestorId.value=res._id;const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();selectedRequestorName.value=n;requestorSearchQuery.value=n;request.value.requestor_address=`${res.address_house_number||''} ${res.address_street||''}, ${res.address_subdivision_zone||''}, ${res.address_city_municipality||''}`.replace(/ ,/g,',').replace(/^,|,$/g,'').trim();request.value.requestor_contact_number=res.contact_number||'';requestorSearchResults.value=[];};
const clearRequestorSelection=(clearInput=true)=>{if(clearInput)requestorSearchQuery.value='';selectedRequestorId.value=null;selectedRequestorName.value='';request.value.requestor_address='';request.value.requestor_contact_number='';requestorSearchResults.value=[];};

// Requested By (Personnel) Search
const debouncedProcessedBySearch=debounce((q)=>searchResidentsAPI(q,'processedBy'),500);
watch(processedBySearchQuery,(nq)=>{if(nq===selectedProcessedByName.value&&selectedProcessedById.value)return;if(!nq||nq.trim()===''){processedBySearchResults.value=[];clearProcessedBySelection(false);}else{debouncedProcessedBySearch(nq);}});
const selectProcessedBy=(res)=>{selectedProcessedById.value=res._id;const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();selectedProcessedByName.value=n;processedBySearchQuery.value=n;processedBySearchResults.value=[];};
const clearProcessedBySelection=(clearInput=true)=>{if(clearInput)processedBySearchQuery.value='';selectedProcessedById.value=null;selectedProcessedByName.value='';processedBySearchResults.value=[];};

async function saveRequest() {
  const { valid } = await form.value.validate();
  if (!valid) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  if (!selectedRequestorId.value) { $toast.fire({ title: 'Please select a requestor.', icon: 'warning' }); return; }
  saving.value = true;
  try {
    const payload = {
      ...request.value,
      requestor_resident_id: selectedRequestorId.value,
      requestor_display_name: selectedRequestorName.value,
      requested_by_resident_id: selectedProcessedById.value, // Will be null if not selected
      requested_by_display_name: selectedProcessedById.value ? selectedProcessedByName.value : (processedBySearchQuery.value.trim() || null), // Use typed name if no ID
      date_of_request: new Date(request.value.date_of_request).toISOString(),
    };
    const { data, error } = await useMyFetch('/api/document-requests', { method: 'POST', body: payload });
    if (error.value || data.value?.error) { $toast.fire({ title: data.value?.error || 'Failed to submit request', icon: 'error' });
    } else { $toast.fire({ title: 'Document request submitted successfully!', icon: 'success' }); router.push('/document-requests'); }
  } catch (e) { console.error(e); $toast.fire({ title: 'An error occurred.', icon: 'error' }); }
  finally { saving.value = false; }
}
</script>

<style scoped> /* Same styles as complaint/new.vue */
.search-results-list { max-height: 150px; overflow-y: auto; border: 1px solid #e0e0e0; margin-top: -1px; background-color: white; z-index: 100; position:absolute; width: calc(100% - 40px); left: 20px;}
.v-label {opacity:var(--v-high-emphasis-opacity);font-size:0.875rem;color:rgba(var(--v-theme-on-surface),var(--v-high-emphasis-opacity));display:block;margin-bottom:4px;}
</style>