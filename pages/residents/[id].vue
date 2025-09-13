<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Resident Details...</p>
    </div>
    <div v-else-if="!form.first_name">
      <v-alert type="error" prominent border="start" text="Resident not found or could not be loaded.">
        <template v-slot:append><v-btn to="/residents">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <div class="d-flex align-center">
            <h2 class="text-h4 font-weight-bold me-4">Resident Details</h2>
            <v-chip v-if="form.status" :color="getStatusColor(form.status)" label>
              Status: {{ form.status }}
            </v-chip>
          </div>
          <!-- UPDATED: Display suffix in the header -->
          <p class="text-grey-darken-1">{{ form.first_name }} {{ form.middle_name ? form.middle_name + ' ' : '' }}{{ form.last_name }}{{ form.suffix ? ' ' + form.suffix : '' }}</p>
        </v-col>
        <v-col class="text-right" cols="auto">
          <div v-if="!editMode" class="d-inline-block me-3">
            <template v-if="form.status === 'Pending'">
              <v-btn color="success" class="me-2" @click="handleActionClick('Approved')" :loading="updatingStatus" prepend-icon="mdi-check-circle-outline">Approve</v-btn>
              <v-btn color="error" @click="handleActionClick('Declined')" :loading="updatingStatus" prepend-icon="mdi-close-circle-outline">Decline</v-btn>
            </template>
            <template v-if="form.status === 'Approved'">
              <v-btn color="grey-darken-1" variant="tonal" @click="handleActionClick('Deactivated')" :loading="updatingStatus" prepend-icon="mdi-account-off-outline">Deactivate</v-btn>
            </template>
            <template v-if="form.status === 'Declined' || form.status === 'Deactivated'">
              <v-btn color="orange" @click="handleActionClick('Pending')" :loading="updatingStatus" prepend-icon="mdi-account-reactivate-outline">Reactivate</v-btn>
            </template>
          </div>
          
          <v-btn v-if="!editMode" color="primary" @click="editMode = true" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn v-if="!editMode" color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-alert
        v-if="form.status_reason"
        :type="form.status === 'Declined' || form.status === 'Deactivated' ? 'warning' : 'info'"
        variant="tonal"
        border="start"
        class="mb-6"
        icon="mdi-information-outline"
        density="compact"
      >
        <template v-slot:title>
          <strong :class="form.status === 'Declined' || form.status === 'Deactivated' ? 'text-warning' : 'text-info'">
            Reason for {{ form.status }} Status
          </strong>
        </template>
        {{ form.status_reason }}
      </v-alert>

      <!-- Personal Information Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Personal Information</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="4"><v-text-field v-model="form.first_name" label="First Name*" :readonly="!editMode" variant="outlined" :error-messages="v$.first_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.middle_name" label="Middle Name" :readonly="!editMode" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.last_name" label="Last Name*" :readonly="!editMode" variant="outlined" :error-messages="v$.last_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4">
              <v-select v-model="form.suffix" :items="suffixOptions" label="Suffix" :readonly="!editMode" variant="outlined" clearable></v-select>
            </v-col>
            <v-col cols="12" md="4"><v-select v-model="form.sex" :items="['Male', 'Female']" label="Sex*" :readonly="!editMode" variant="outlined" placeholder="Select Sex" :error-messages="v$.sex.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.date_of_birth" label="Date of Birth*" type="date" :readonly="!editMode" variant="outlined" :error-messages="v$.date_of_birth.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field :model-value="calculatedAge" label="Age" readonly variant="outlined" hint="Auto-calculated" persistent-hint></v-text-field></v-col>
            <v-col cols="12" md="4"><v-select v-model="form.civil_status" :items="['Single', 'Married', 'Widowed', 'Separated']" label="Civil Status*" :readonly="!editMode" variant="outlined" placeholder="Select Civil Status" :error-messages="v$.civil_status.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-select v-model="form.citizenship" :items="['Filipino', 'Other']" label="Citizenship*" :readonly="!editMode" variant="outlined" placeholder="Select Citizenship" :error-messages="v$.citizenship.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-select v-model="form.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)', 'Student', 'Retired', 'Not Applicable']" label="Occupation Status*" :readonly="!editMode" variant="outlined" :error-messages="v$.occupation_status.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.email" label="Email Address*" type="email" :readonly="!editMode" variant="outlined" :error-messages="v$.email.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.contact_number" label="Contact Number*" :readonly="!editMode" variant="outlined" maxlength="11" :error-messages="v$.contact_number.$errors.map(e => e.$message)"></v-text-field></v-col>
          </v-row>
        </v-card-text>
      </v-card>

        <!-- NEW: Household Relationship Card -->
      <v-card class="mb-6" flat border v-if="!form.is_household_head">
        <v-card-title class="text-h6 font-weight-medium">Household Relationship</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.relationship_to_head"
                label="Relationship to Head"
                readonly
                variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <div v-if="editMode">
                <v-file-input 
                  v-model="form.proof_of_relationship_file" 
                  label="Upload to Replace Proof of Relationship" 
                  variant="outlined" 
                  accept="image/*,application/pdf" 
                  clearable
                ></v-file-input>
              </div>
              <div v-else>
                <label class="v-label mb-1">Uploaded Proof of Relationship</label>
                <v-img 
                  v-if="form.proof_of_relationship_base64"
                  :src="form.proof_of_relationship_base64" 
                  height="150" 
                  contain 
                  class="mt-2 elevation-1 cursor-pointer" 
                  @click="openGallery('proof_of_relationship')"
                ></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Address Information Card -->
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Address Information</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field 
                v-model="form.address_unit_room_apt_number" 
                label="Unit/Room/Apartment number" 
                :readonly="!editMode" 
                variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.address_house_number" label="House Number/Lot/Block*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_house_number.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.address_street" label="Street*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_street.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok*" :readonly="!editMode" variant="outlined" :error-messages="v$.address_subdivision_zone.$errors.map(e => e.$message)"></v-text-field></v-col>
            <!-- NEW FIELD: Type of Household -->
            <v-col cols="12" md="6">
              <v-select 
                v-model="form.type_of_household" 
                :items="['Owner', 'Tenant/Border', 'Sharer']" 
                label="Type of Household" 
                :readonly="!editMode" 
                variant="outlined" 
                placeholder="Select Type"
                :error-messages="v$.type_of_household.$errors.map(e => e.$message)"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.address_city_municipality" label="City/Municipality" readonly variant="outlined"></v-text-field></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="form.years_at_current_address" label="Years at Current Address*" type="number" :readonly="!editMode" variant="outlined" :error-messages="v$.years_at_current_address.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.proof_of_residency_file" label="Upload to Replace Proof of Residency" variant="outlined" accept="image/*,application/pdf" clearable multiple></v-file-input>
              <div v-else>
                <label class="v-label mb-1">Uploaded Proof of Residency</label>
                <div v-if="form.proof_of_residency_base64 && form.proof_of_residency_base64.length > 0" class="d-flex flex-wrap gap-2 mt-2">
                  <div v-for="(src, idx) in form.proof_of_residency_base64" :key="idx" class="d-inline-block">
                    <v-img :src="src" height="100" width="100" contain class="border rounded elevation-1 cursor-pointer" @click="openGallery('proof_of_residency', idx)"></v-img>
                  </div>
                </div>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>

            <!-- NEW: Authorization Letter Field -->
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.authorization_letter_file" label="Upload to Replace Authorization Letter (Optional)" variant="outlined" accept="image/*,application/pdf" clearable></v-file-input>
              <div v-else>
                <label class="v-label mb-1">Uploaded Authorization Letter (Optional)</label>
                <v-img v-if="form.authorization_letter_base64" :src="form.authorization_letter_base64" height="150" contain class="mt-2 elevation-1 cursor-pointer" @click="openGallery('authorization_letter')"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- (Rest of the template including Voter and PWD cards remains unchanged, but their click handlers are also now connected to the new viewer) -->
      <v-card class="mb-6" flat border v-if="calculatedAge >= 18">
        <v-card-title class="text-h6 font-weight-medium">Voter Information</v-card-title>
        <v-card-text class="pt-2">
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Voter?</label><v-radio-group v-model="form.is_voter" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="form.is_voter">
            <v-col cols="12" md="6"><v-text-field v-model="form.voter_id_number" label="Voter's ID Number" :readonly="!editMode" variant="outlined" :error-messages="v$.voter_id_number.$errors.map(e => e.$message)" hint="Required if no ID is uploaded" persistent-hint></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.voter_id_file" label="Upload to Replace Voter's ID" variant="outlined" accept="image/*,application/pdf" clearable></v-file-input>
              <div v-else><label class="v-label mb-1">Uploaded Voter's ID</label>
                <v-img v-if="form.voter_registration_proof_base64" :src="form.voter_registration_proof_base64" height="150" contain class="mt-2 elevation-1 cursor-pointer" @click="openGallery('voter_id')"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
      
      <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Special Classification</v-card-title>
        <v-card-text class="pt-2">
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label><v-radio-group v-model="form.is_pwd" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="form.is_pwd">
            <v-col cols="12" md="6"><v-text-field v-model="form.pwd_id" label="PWD ID Number" :readonly="!editMode" variant="outlined" :error-messages="v$.pwd_id.$errors.map(e => e.$message)" hint="Required if no ID card is uploaded" persistent-hint></v-text-field></v-col>
            <v-col cols="12" md="6">
              <v-file-input v-if="editMode" v-model="form.pwd_card_file" label="Upload to Replace PWD ID Card" variant="outlined" accept="image/*" clearable></v-file-input>
              <div v-else><label class="v-label mb-1">Uploaded PWD ID Card</label>
                <v-img v-if="form.pwd_card_base64" :src="form.pwd_card_base64" height="150" contain class="mt-2 elevation-1 cursor-pointer" @click="openGallery('pwd_card')"></v-img>
                <p v-else class="text-grey mt-2">No file uploaded.</p>
              </div>
            </v-col>
          </v-row>
          <v-row v-if="isSenior">
            <v-divider class="my-4"></v-divider>
            <v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Senior Citizen? (Age 60+)</label><v-radio-group v-model="form.is_senior_citizen" inline :readonly="!editMode"><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col>
            <template v-if="form.is_senior_citizen">
              <v-col cols="12" md="6"><v-text-field v-model="form.senior_citizen_id" label="Senior Citizen ID Number" :readonly="!editMode" variant="outlined" :error-messages="v$.senior_citizen_id.$errors.map(e => e.$message)" hint="Required if no ID card is uploaded" persistent-hint></v-text-field></v-col>
              <v-col cols="12" md="6">
                <v-file-input v-if="editMode" v-model="form.senior_citizen_card_file" label="Upload to Replace Senior ID" variant="outlined" accept="image/*" clearable></v-file-input>
                <div v-else><label class="v-label mb-1">Uploaded Senior Citizen ID</label>
                  <v-img v-if="form.senior_citizen_card_base64" :src="form.senior_citizen_card_base64" height="150" contain class="mt-2 elevation-1 cursor-pointer" @click="openGallery('senior_card')"></v-img>
                  <p v-else class="text-grey mt-2">No file uploaded.</p>
                </div>
              </v-col>
            </template>
          </v-row>
        </v-card-text>
      </v-card>
      
      <!-- Other cards remain unchanged... -->

      <!-- NEW: Image Viewer Dialog with Zoom (Replaces old gallery dialog) -->
      <v-dialog v-model="imageViewerDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
        <v-card>
          <v-toolbar dark color="primary">
            <v-btn icon dark @click="showPrevImage" :disabled="currentGalleryImages.length <= 1">
              <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
            <v-toolbar-title>{{ viewerImageTitle }}</v-toolbar-title>
            <v-btn icon dark @click="showNextImage" :disabled="currentGalleryImages.length <= 1">
              <v-icon>mdi-chevron-right</v-icon>
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn icon dark @click="imageViewerDialog = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-text
            class="d-flex justify-center align-center"
            style="background-color: rgba(0,0,0,0.8); position: relative; overflow: auto;"
          >
            <v-img
              :key="viewerImageSrc"
              :src="viewerImageSrc"
              contain
              max-height="90vh"
              max-width="90vw"
              :style="imageStyle"
              class="bg-surface-variant"
            ></v-img>
            <div class="zoom-controls">
              <v-btn icon="mdi-magnify-minus-outline" @click="zoomOut" class="mx-1" title="Zoom Out"></v-btn>
              <v-btn icon="mdi-fit-to-screen-outline" @click="resetZoom" class="mx-1" title="Reset Zoom"></v-btn>
              <v-btn icon="mdi-magnify-plus-outline" @click="zoomIn" class="mx-1" title="Zoom In"></v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
      
      <!-- Other dialogs (action reason, delete confirmation) remain unchanged -->
      <v-dialog v-model="actionReasonDialog" persistent max-width="500px">
        <v-card>
          <v-card-title class="text-h5">{{ dialogTitle }} Account</v-card-title>
          <v-card-text>
            <p class="mb-4">Please provide a reason for {{ dialogActionText }} the account for <strong>{{ form.first_name }} {{ form.last_name }}</strong>.</p>
            <v-textarea
              v-model="actionReason"
              :label="`Reason for ${dialogActionText}`"
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
            <v-btn color="grey" text @click="actionReasonDialog = false">Cancel</v-btn>
            <v-btn :color="dialogButtonColor" :disabled="!actionReason" :loading="updatingStatus" @click="confirmActionWithReason">Confirm {{ dialogTitle }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="confirmDeleteDialog" persistent max-width="500px">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
            Confirm Deletion
          </v-card-title>
          <v-card-text>
            Are you sure you want to permanently delete the record for 
            <strong>{{ form.first_name }} {{ form.last_name }}</strong>? 
            <br><br>
            This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" text @click="confirmDeleteDialog = false" :disabled="deleting">Cancel</v-btn>
            <v-btn color="error" variant="flat" @click="deleteResident" :loading="deleting">Delete Resident</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers, numeric } from '@vuelidate/validators';
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const residentId = route.params.id;

const suffixOptions = ['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI']; // Define suffix options

const form = reactive({
  first_name: '', middle_name: '', last_name: '', suffix: null, // ADDED SUFFIX
  sex: null, date_of_birth: '', civil_status: null,
  citizenship: 'Filipino', occupation_status: null, email: '', contact_number: '', newPassword: '', confirmNewPassword: '',
  address_house_number: '', 
  address_unit_room_apt_number: '', // NEW: Unit/Room/Apartment number
  address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  type_of_household: null, // NEW: Type of Household
  years_at_current_address: null, 
  proof_of_residency_file: null, // This is for new file input, could be a single File or an array of Files
  proof_of_residency_base64: [], // This is the array of base64 strings fetched from the backend
  authorization_letter_file: null, // NEW: Authorization Letter file object
  authorization_letter_base64: null, // NEW: Authorization Letter base64 string
  is_voter: false, voter_id_number: '', voter_id_file: null, voter_registration_proof_base64: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null, pwd_card_base64: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null, senior_citizen_card_base64: null,
  is_household_head: false, household_members_details: [], status: '', status_reason: '',   relationship_to_head: '',
  proof_of_relationship_file: null,
  proof_of_relationship_base64: null,
});
const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);
const showNewPassword = ref(false);
const showConfirmNewPassword = ref(false);

const householdMemberSearchQuery = ref('');
const eligibleMemberSearchResults = ref([]);
const isLoadingEligibleMembers = ref(false);

// --- NEW: Image Viewer State ---
const imageViewerDialog = ref(false);
const viewerImageSrc = ref('');
const viewerImageTitle = ref('');
const zoomLevel = ref(1);

const currentGalleryImages = ref([]); // Stores array of srcs for current gallery set (e.g., all proof of residency)
const currentImageIndex = ref(0); // Index within currentGalleryImages

const updatingStatus = ref(false);
const actionReasonDialog = ref(false);
const actionReason = ref('');
const actionType = ref('');

const getStatusColor = (s) => ({ 'Approved': 'success', 'Pending': 'warning', 'Declined': 'error', 'Deactivated': 'grey' }[s] || 'default');

// --- COMPUTED PROPERTIES ---
const calculatedAge = computed(() => {
  if (!form.date_of_birth) return null;
  const birthDate = new Date(form.date_of_birth); if (isNaN(birthDate.getTime())) return null;
  let age = new Date().getFullYear() - birthDate.getFullYear();
  const m = new Date().getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
});

const isSenior = computed(() => calculatedAge.value !== null && calculatedAge.value >= 60);

const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value})`,
  transition: 'transform 0.2s ease-out'
}));

// --- FUNCTIONS ---

// UPDATED: This function now populates the viewer and handles multi-image sets
function openGallery(id, initialIndex = 0) {
  currentGalleryImages.value = []; // Reset current gallery
  currentImageIndex.value = 0; // Reset index

  if (id === 'proof_of_residency' && form.proof_of_residency_base64 && form.proof_of_residency_base64.length > 0) {
    currentGalleryImages.value = form.proof_of_residency_base64;
    currentImageIndex.value = Math.min(Math.max(0, initialIndex), currentGalleryImages.value.length - 1);
    viewerImageSrc.value = currentGalleryImages.value[currentImageIndex.value];
    viewerImageTitle.value = `Proof of Residency (${currentImageIndex.value + 1} of ${currentGalleryImages.value.length})`;
  } else {
    // Handle single images
    let singleImageSrc = null;
    let singleImageTitle = '';

    if (id === 'authorization_letter' && form.authorization_letter_base64) {
      singleImageSrc = form.authorization_letter_base64;
      singleImageTitle = 'Authorization Letter';
    } else if (id === 'proof_of_relationship' && form.proof_of_relationship_base64) {
      singleImageSrc = form.proof_of_relationship_base64;
      singleImageTitle = 'Proof of Relationship';
    } else if (id === 'voter_id' && form.voter_registration_proof_base64) {
      singleImageSrc = form.voter_registration_proof_base64;
      singleImageTitle = "Uploaded Voter's ID";
    } else if (id === 'pwd_card' && form.pwd_card_base64) {
      singleImageSrc = form.pwd_card_base64;
      singleImageTitle = 'Uploaded PWD ID Card';
    } else if (id === 'senior_card' && form.senior_citizen_card_base64) {
      singleImageSrc = form.senior_citizen_card_base64;
      singleImageTitle = 'Uploaded Senior Citizen ID';
    }

    if (singleImageSrc) {
      currentGalleryImages.value = [singleImageSrc]; // Treat as a single-item gallery
      currentImageIndex.value = 0;
      viewerImageSrc.value = singleImageSrc;
      viewerImageTitle.value = singleImageTitle;
    } else {
      // No image found, don't open dialog
      return;
    }
  }

  zoomLevel.value = 1; // Reset zoom on open
  imageViewerDialog.value = true;
}

// NEW: Zoom control functions
const zoomIn = () => { zoomLevel.value += 0.2; };
const zoomOut = () => { zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.2); };
const resetZoom = () => { zoomLevel.value = 1; };

// NEW: Navigation for multi-image galleries
const showNextImage = () => {
  if (currentGalleryImages.value.length > 1) {
    currentImageIndex.value = (currentImageIndex.value + 1) % currentGalleryImages.value.length;
    viewerImageSrc.value = currentGalleryImages.value[currentImageIndex.value];
    // Update title for multi-image type
    if (viewerImageTitle.value.startsWith('Proof of Residency')) {
      viewerImageTitle.value = `Proof of Residency (${currentImageIndex.value + 1} of ${currentGalleryImages.value.length})`;
    }
    resetZoom();
  }
};

const showPrevImage = () => {
  if (currentGalleryImages.value.length > 1) {
    currentImageIndex.value = (currentImageIndex.value - 1 + currentGalleryImages.value.length) % currentGalleryImages.value.length;
    viewerImageSrc.value = currentGalleryImages.value[currentImageIndex.value];
    // Update title for multi-image type
    if (viewerImageTitle.value.startsWith('Proof of Residency')) {
      viewerImageTitle.value = `Proof of Residency (${currentImageIndex.value + 1} of ${currentGalleryImages.value.length})`;
    }
    resetZoom();
  }
};

const rules = {
  first_name: { required }, last_name: { required }, suffix: {}, // ADDED SUFFIX RULE (optional)
  sex: { required }, date_of_birth: { required },
  civil_status: { required }, citizenship: { required }, occupation_status: { required },
  email: { email }, contact_number: {  },
  address_house_number: { required, numeric }, 
  address_unit_room_apt_number: {}, // NEW: Unit/Room/Apartment number (optional)
  address_street: { required }, 
  address_subdivision_zone: { required },
  type_of_household: {  }, // NEW: Type of Household (required)
  years_at_current_address: { numeric },
  newPassword: { minLength: minLength(6) },
  confirmNewPassword: { sameAs: helpers.withMessage('Passwords do not match.', sameAs(computed(() => form.newPassword))) },
  // START: FIXED VALIDATION LOGIC
  voter_id_number: {
    requiredIf: helpers.withMessage(
      "Voter's ID Number or uploaded ID is required.",
      requiredIf(() => form.is_voter && !(form.voter_id_file && form.voter_id_file.length) && !form.voter_registration_proof_base64)
    )
  },
  pwd_id: {
    requiredIf: helpers.withMessage(
      'PWD ID Number or uploaded card is required.',
      requiredIf(() => form.is_pwd && !(form.pwd_card_file && form.pwd_card_file.length) && !form.pwd_card_base64)
    )
  },
  senior_citizen_id: {
    requiredIf: helpers.withMessage(
      'Senior Citizen ID Number or uploaded card is required.',
      requiredIf(() => form.is_senior_citizen && !(form.senior_citizen_card_file && form.senior_citizen_card_file.length) && !form.senior_citizen_card_base64)
    )
  },
  // END: FIXED VALIDATION LOGIC
  // NEW: Authorization Letter validation (optional, can add more specific checks if needed)
  authorization_letter_file: {},
  authorization_letter_base64: {},
};
const v$ = useVuelidate(rules, form);

onMounted(async () => { await fetchResident(); });

const dialogTitle = computed(() => {
    if (actionType.value === 'Pending') return 'Reactivate';
    return actionType.value;
});

const dialogActionText = computed(() => {
    if (actionType.value === 'Pending') return 'reactivating';
    if (actionType.value === 'Deactivated') return 'deactivating';
    return 'declining';
});

const dialogButtonColor = computed(() => ({
    Declined: 'error',
    Deactivated: 'warning',
    Pending: 'orange'
}[actionType.value] || 'primary'));

function handleActionClick(newStatus) {
  actionType.value = newStatus;
  if (['Declined', 'Deactivated', 'Pending'].includes(newStatus)) {
    actionReason.value = '';
    actionReasonDialog.value = true;
  }
  else if (newStatus === 'Approved') {
    updateResidentStatus(newStatus);
  }
}

async function confirmActionWithReason() {
  if (!actionReason.value) {
    $toast.fire({ title: 'A reason is required.', icon: 'warning' });
    return;
  }
  await updateResidentStatus(actionType.value, actionReason.value);
  actionReasonDialog.value = false;
}

async function updateResidentStatus(newStatus, reason = null) {
  updatingStatus.value = true;
  try {
    const payload = { status: newStatus };
    if (reason) { payload.reason = reason; }

    await useMyFetch(`/api/residents/${residentId}/status`, {
      method: 'PATCH',
      body: payload,
    });
    
    $toast.fire({ title: 'Status updated successfully!', icon: 'success' });
    await fetchResident();
  } catch (e) {
    // Error handled by useMyFetch
  } finally {
    updatingStatus.value = false;
  }
}

async function fetchResident() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/residents/${residentId}/household-details`);
    if (error.value) throw new Error('Resident not found.');
    
    const residentData = data.value;
    Object.assign(form, { ...residentData.resident, household_members_details: residentData.householdMembers || [] });
    form.date_of_birth = form.date_of_birth ? new Date(form.date_of_birth).toISOString().split('T')[0] : '';
    // ensure suffix is properly initialized even if null from backend
    form.suffix = residentData.resident.suffix || null; 
    // NEW: Ensure authorization_letter_base64 is populated from fetched data
    form.authorization_letter_base64 = residentData.resident.authorization_letter_base64 || null;
    // Ensure proof_of_residency_base64 is always an array
    form.proof_of_residency_base64 = residentData.resident.proof_of_residency_base64 || [];
    // NEW: Ensure address_unit_room_apt_number and type_of_household are initialized
    form.address_unit_room_apt_number = residentData.resident.address_unit_room_apt_number || '';
    form.type_of_household = residentData.resident.type_of_household || null;

    originalFormState.value = JSON.parse(JSON.stringify(form));
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/residents'); }
  finally { loading.value = false; }
}

const cancelEdit = () => { Object.assign(form, JSON.parse(JSON.stringify(originalFormState.value))); v$.value.$reset(); editMode.value = false; };

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || file.length === 0) { resolve(null); return; }
    // If the file is already a base64 string, return it as is. This handles cases where
    // an existing base64 image is not replaced and thus remains a string in the form.
    if (typeof file === 'string' && file.startsWith('data:')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    const payload = { ...form }; // 'form' now includes 'suffix', address_unit_room_apt_number, type_of_household
    payload.household_member_ids = form.household_members_details.map(m => m._id);
    delete payload.household_members_details;
    
    // Convert new files to base64 only if a new file is uploaded
    // Otherwise, keep the existing base64 string
    payload.voter_registration_proof_base64 = form.voter_id_file ? await convertFileToBase64(form.voter_id_file) : payload.voter_registration_proof_base64;
    payload.pwd_card_base64 = form.pwd_card_file ? await convertFileToBase64(form.pwd_card_file) : payload.pwd_card_base64;
    payload.senior_citizen_card_base64 = form.senior_citizen_card_file ? await convertFileToBase64(form.senior_citizen_card_file) : payload.senior_citizen_card_base64;
    
    // Handle proof_of_residency_base64 as an array. If new files are uploaded, map them to base64.
    // If form.proof_of_residency_file is null/empty, retain the existing array from backend.
    if (form.proof_of_residency_file && form.proof_of_residency_file.length > 0) {
      payload.proof_of_residency_base64 = await Promise.all(form.proof_of_residency_file.map(file => convertFileToBase64(file)));
    } else {
      payload.proof_of_residency_base64 = payload.proof_of_residency_base64; // Retain existing array
    }

    payload.proof_of_relationship_base64 = form.proof_of_relationship_file ? await convertFileToBase64(form.proof_of_relationship_file) : payload.proof_of_relationship_base64;
    payload.authorization_letter_base64 = form.authorization_letter_file ? await convertFileToBase64(form.authorization_letter_file) : payload.authorization_letter_base64;

    // Remove the temporary file objects as they are not sent to the backend directly
    delete payload.voter_id_file; 
    delete payload.pwd_card_file; 
    delete payload.senior_citizen_card_file; 
    delete payload.proof_of_residency_file; 
    delete payload.proof_of_relationship_file;
    delete payload.authorization_letter_file;
    delete payload.newPassword; // Only for frontend, not part of API payload
    delete payload.confirmNewPassword; // Only for frontend, not part of API payload
    
    await useMyFetch(`/api/residents/${residentId}`, { method: 'PUT', body: payload });
    $toast.fire({ title: 'Resident updated successfully!', icon: 'success' });
    await fetchResident();
    editMode.value = false;
  } catch(e) { console.error(e) }
  finally { saving.value = false; }
}

const debounce = (fn,delay) => { let t; return (...a)=>{ clearTimeout(t); t = setTimeout(() => fn.apply(this,a), delay); }; };
const searchMembers = debounce(async (query) => {
  if (!query || query.length < 2) { eligibleMemberSearchResults.value = []; return; }
  isLoadingEligibleMembers.value = true;
  try {
    const { data } = await useMyFetch('/api/residents/eligible-for-household-search', { query: { searchKey: query } });
    eligibleMemberSearchResults.value = (data.value?.searchResults || []).map(r => ({ _id: r._id, name: `${r.first_name} ${r.last_name}`, ...r }));
  } finally { isLoadingEligibleMembers.value = false; }
}, 500);

watch(householdMemberSearchQuery, (nq) => searchMembers(nq));

const addMember = (selectedId) => {
  if (!selectedId) return;
  const member = eligibleMemberSearchResults.value.find(r => r._id === selectedId);
  if (member && !form.household_members_details.some(m => m._id === member._id)) {
    form.household_members_details.push(member);
  }
  householdMemberSearchQuery.value = ''; eligibleMemberSearchResults.value = [];
};
const removeMember = (index) => { form.household_members_details.splice(index, 1); };

async function deleteResident() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/residents/${residentId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete resident.');
    $toast.fire({ title: 'Resident deleted!', icon: 'success' });
    router.push('/residents-account-management');
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { deleting.value = false; confirmDeleteDialog.value = false; }
}
</script>

<style scoped>
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

.gap-2 { /* Added utility class for spacing from the other component */
  gap: 8px;
}
</style>