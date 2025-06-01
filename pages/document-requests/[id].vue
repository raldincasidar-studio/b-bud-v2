<template>
  <v-container class="my-10">
    <div v-if="loading" class="text-center pa-10"><v-progress-circular indeterminate color="primary" size="64"></v-progress-circular><p class="mt-2">Loading...</p></div>
    <div v-else-if="!requestData._id && !errorLoading"><v-alert type="warning" prominent border="start">Request not found.</v-alert></div>
    <div v-else-if="errorLoading"><v-alert type="error" prominent border="start">Error loading request.</v-alert></div>
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col><h2 class="text-truncate" :title="`${requestData.request_type} by ${requestData.requestor_display_name}`">Document Request Details</h2></v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="toggleEditMode(true)" prepend-icon="mdi-pencil" class="mr-2" variant="tonal">Edit</v-btn>
          <v-btn v-if="editMode" color="green" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" variant="tonal" :loading="saving">Save</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="red" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card prepend-icon="mdi-file-document-edit-outline" :title="editMode ? 'Edit Document Request' : 'View Document Request'">
        <v-card-text>
          <v-form ref="form">
            <v-row>
                <v-col cols="12" md="6">
                    <v-text-field v-model="editableRequest.request_type" label="Request Type" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field v-model="editableRequest.date_of_request" label="Date of Request" type="date" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
                </v-col>
            </v-row>
            <v-divider class="my-4"></v-divider>
            <h3 class="text-subtitle-1 mb-2">Requestor Information</h3>
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Full Name of Requestor <span v-if="editMode" class="text-red">*</span></label>
                 <v-text-field v-if="editMode" v-model="requestorSearchQuery" label="Search to Change Requestor..." prepend-inner-icon="mdi-account-search-outline" variant="outlined" density="compact" clearable @click:clear="clearRequestorSelection" :loading="isLoadingRequestors" :rules="[rules.requestorSelected]" :hint="editableRequest.requestor_display_name ? `Current: ${editableRequest.requestor_display_name}` : 'Type to search'" persistent-hint></v-text-field>
                <v-text-field v-else :model-value="editableRequest.requestor_display_name || 'N/A'" label="Requestor Name" variant="outlined" density="compact" readonly></v-text-field>
                 <div v-if="editMode && requestorSearchQuery && requestorSearchQuery.trim().length >= 2 && !isLoadingRequestors" class="search-results-container"><v-list v-if="requestorSearchResults.length > 0" density="compact" class="elevation-1 search-results-list"><v-list-item v-for="res in requestorSearchResults" :key="res._id" @click="selectRequestor(res)" :title="`${res.first_name} ${res.middle_name||''} ${res.last_name}`.trim()" ripple><v-list-item-subtitle>{{res.email||'No email'}}</v-list-item-subtitle></v-list-item></v-list><p v-else class="text-grey pa-3 text-center">No residents found for requestor.</p></div>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableRequest.requestor_address" label="Requestor Address" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="editableRequest.requestor_contact_number" label="Requestor Contact Number" :rules="[rules.required, rules.contactFormat]" :readonly="!editMode" variant="outlined" density="compact" type="tel"></v-text-field>
              </v-col>
            </v-row>
             <v-divider class="my-4"></v-divider>
            <h3 class="text-subtitle-1 mb-2">Request Processing Information</h3>
            <v-row>
                <v-col cols="12">
                    <v-textarea v-model="editableRequest.purpose_of_request" label="Purpose of Request" :rules="[rules.required]" :readonly="!editMode" variant="outlined" rows="3" auto-grow></v-textarea>
                </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Requested By (Personnel - Optional)</label>
                 <v-text-field v-if="editMode" v-model="processedBySearchQuery" label="Search Personnel (Resident/Admin)..." prepend-inner-icon="mdi-account-search-outline" variant="outlined" density="compact" clearable @click:clear="clearProcessedBySelection" :loading="isLoadingProcessedBy" :hint="editableRequest.requested_by_display_name ? `Current: ${editableRequest.requested_by_display_name}` : 'Search or leave blank'" persistent-hint></v-text-field>
                <v-text-field v-else :model-value="editableRequest.requested_by_display_name || 'N/A'" label="Requested By" variant="outlined" density="compact" readonly></v-text-field>
                 <div v-if="editMode && processedBySearchQuery && processedBySearchQuery.trim().length >= 2 && !isLoadingProcessedBy" class="search-results-container"><v-list v-if="processedBySearchResults.length > 0" density="compact" class="elevation-1 search-results-list"><v-list-item v-for="res in processedBySearchResults" :key="res._id" @click="selectProcessedBy(res)" :title="`${res.first_name} ${res.middle_name||''} ${res.last_name}`.trim()" ripple><v-list-item-subtitle>{{res.email||'No email'}}</v-list-item-subtitle></v-list-item></v-list><p v-else class="text-grey pa-3 text-center">No personnel found. You can still clear if needed.</p></div>
              </v-col>
              <v-col cols="12" md="6">
                <v-select v-model="editableRequest.document_status" label="Document Status" :items="statusOptions" :rules="[rules.required]" :readonly="!editMode" variant="outlined" density="compact"></v-select>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </v-card>
    </div>
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400"><!-- Delete Dialog --></v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast, $swal } = useNuxtApp();
const route = useRoute(); const router = useRouter(); const requestId = route.params.id;
const form = ref(null);

const requestData = ref({});
const editableRequest = ref({ requestor_resident_id:null, requestor_display_name:'', requested_by_resident_id:null, requested_by_display_name:'' });
const loading = ref(true); const errorLoading = ref(false); const editMode = ref(false);
const saving = ref(false); const deleting = ref(false); const confirmDeleteDialog = ref(false);

const requestorSearchQuery = ref(''); const requestorSearchResults = ref([]); const isLoadingRequestors = ref(false);
const processedBySearchQuery = ref(''); const processedBySearchResults = ref([]); const isLoadingProcessedBy = ref(false);

const statusOptions = ['Pending','Processing','Ready for Pickup','Released','Denied','Cancelled'];
const rules = { required:v=>!!v||'Required.',requestorSelected:v=>!!editableRequest.value.requestor_resident_id||'Requestor needed.',contactFormat:v=>(/^\+?[0-9\s-]{7,15}$/.test(v)||v==='')||'Invalid contact.'};

onMounted(async()=>{await fetchRequest();});
function formatDateForInput(isoStr){if(!isoStr)return'';try{const d=new Date(isoStr);return`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`}catch(e){return isoStr;}}
async function fetchRequest(){loading.value=true;errorLoading.value=false;try{const{data,error}=await useMyFetch(`/api/document-requests/${requestId}`);if(error.value||!data.value?.request){errorLoading.value=true;requestData.value={};console.error(error.value);}else{requestData.value={...data.value.request};resetEditableData();}}catch(e){errorLoading.value=true;console.error(e);}finally{loading.value=false;}}
function resetEditableData(){editableRequest.value=JSON.parse(JSON.stringify(requestData.value));if(editableRequest.value.date_of_request)editableRequest.value.date_of_request=formatDateForInput(editableRequest.value.date_of_request);requestorSearchQuery.value=editableRequest.value.requestor_display_name||'';processedBySearchQuery.value=editableRequest.value.requested_by_display_name||'';requestorSearchResults.value=[];processedBySearchResults.value=[];}
function toggleEditMode(e){editMode.value=e;if(e)resetEditableData();}
function cancelEdit(){toggleEditMode(false);resetEditableData();}

function debounce(fn,delay){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),delay);};}
const searchResidentsAPI=async(q,type)=>{const tq=typeof q==='string'?q.trim():'';if(tq.length<2){if(type==='requestor')requestorSearchResults.value=[];if(type==='processedBy')processedBySearchResults.value=[];return;}if(type==='requestor')isLoadingRequestors.value=true;if(type==='processedBy')isLoadingProcessedBy.value=true;try{const{data,error}=await useMyFetch('/api/residents/search',{query:{q:tq}});if(error.value){console.error(error.value)}else{if(type==='requestor')requestorSearchResults.value=data.value?.residents||[];if(type==='processedBy')processedBySearchResults.value=data.value?.residents||[];}}catch(e){console.error(e)}finally{if(type==='requestor')isLoadingRequestors.value=false;if(type==='processedBy')isLoadingProcessedBy.value=false;}};

const debouncedRequestorSearch=debounce((q)=>searchResidentsAPI(q,'requestor'),500);
watch(requestorSearchQuery,(nq,oq)=>{if(nq===editableRequest.value.requestor_display_name&&editableRequest.value.requestor_resident_id){if(nq!==oq){}else return;}if(!nq||typeof nq!=='string'||nq.trim().length<2){requestorSearchResults.value=[];return;}debouncedRequestorSearch(nq);});
const selectRequestor=(res)=>{editableRequest.value.requestor_resident_id=res._id;const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();editableRequest.value.requestor_display_name=n;requestorSearchQuery.value=n;editableRequest.value.requestor_address=`${res.address_house_number||''} ${res.address_street||''}, ${res.address_subdivision_zone||''}, ${res.address_city_municipality||''}`.replace(/ ,/g,',').replace(/^,|,$/g,'').trim();editableRequest.value.requestor_contact_number=res.contact_number||'';requestorSearchResults.value=[];};
const clearRequestorSelection=()=>{requestorSearchQuery.value='';editableRequest.value.requestor_resident_id=null;editableRequest.value.requestor_display_name='';editableRequest.value.requestor_address='';editableRequest.value.requestor_contact_number='';requestorSearchResults.value=[];};

const debouncedProcessedBySearch=debounce((q)=>searchResidentsAPI(q,'processedBy'),500);
watch(processedBySearchQuery,(nq,oq)=>{if(nq===editableRequest.value.requested_by_display_name&&editableRequest.value.requested_by_resident_id){if(nq!==oq){}else return;}if(nq!==editableRequest.value.requested_by_display_name&&editableRequest.value.requested_by_resident_id){editableRequest.value.requested_by_resident_id=null;}editableRequest.value.requested_by_display_name=nq;if(!nq||typeof nq!=='string'||nq.trim().length<2){processedBySearchResults.value=[];return;}debouncedProcessedBySearch(nq);});
const selectProcessedBy=(res)=>{editableRequest.value.requested_by_resident_id=res._id;const n=`${res.first_name||''} ${res.middle_name||''} ${res.last_name||''}`.trim();editableRequest.value.requested_by_display_name=n;processedBySearchQuery.value=n;processedBySearchResults.value=[];};
const clearProcessedBySelection=()=>{processedBySearchQuery.value='';editableRequest.value.requested_by_resident_id=null;editableRequest.value.requested_by_display_name='';processedBySearchResults.value=[];};

async function saveChanges(){const{valid}=await form.value.validate();if(!valid){$toast.fire({title:'Errors.',icon:'error'});return;}if(!editableRequest.value.requestor_resident_id){$toast.fire({title:'Select requestor.',icon:'warning'});return;}saving.value=true;try{const payload={...editableRequest.value};if(payload.date_of_request)payload.date_of_request=new Date(payload.date_of_request).toISOString();const{data,error}=await useMyFetch(`/api/document-requests/${requestId}`,{method:'PUT',body:payload});if(error.value||data.value?.error){$toast.fire({title:data.value?.error||'Update failed.',icon:'error'});}else{$toast.fire({title:'Request updated!',icon:'success'});requestData.value={...data.value.request};resetEditableData();toggleEditMode(false);}}catch(e){console.error(e);$toast.fire({title:'Error.',icon:'error'});}finally{saving.value=false;}}
async function deleteRequest(){const{isConfirmed}=await $swal({title:`Delete Request?`,text:'Cannot be reversed!',showCancelButton:true});if(!isConfirmed)return;deleting.value=true;try{const{error}=await useMyFetch(`/api/document-requests/${requestId}`,{method:'DELETE'});if(error.value){$toast.fire({title:'Delete failed.',icon:'error'});}else{$toast.fire({title:'Deleted!',icon:'success'});router.push('/document-requests');}}catch(e){console.error(e);$toast.fire({title:'Error.',icon:'error'});}finally{deleting.value=false;confirmDeleteDialog.value=false;}}
</script>

<style scoped>/* Same styles */
.search-results-list { max-height: 150px; overflow-y: auto; border: 1px solid #e0e0e0; margin-top: -1px; background-color: white; z-index: 100; position:absolute; width: calc(100% - 40px); left: 20px;}
.v-label {opacity:var(--v-high-emphasis-opacity);font-size:0.875rem;color:rgba(var(--v-theme-on-surface),var(--v-high-emphasis-opacity));display:block;margin-bottom:4px;}
</style>