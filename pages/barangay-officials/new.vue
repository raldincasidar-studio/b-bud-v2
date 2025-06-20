<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Add New Barangay Official</h2>
        <p class="text-grey-darken-1">Enter the details for the new official.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          :loading="saving"
          size="large"
          @click="saveOfficial"
          prepend-icon="mdi-content-save"
          color="primary"
        >
          Save Official
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        <!-- Profile Picture Upload -->
        <v-row>
          <v-col cols="12" md="4">
            <h3 class="text-h6 font-weight-medium mb-2">Profile Picture</h3>
             <v-avatar size="120" color="grey-lighten-3" class="mb-4">
                <v-img v-if="form.photo_url" :src="form.photo_url" cover></v-img>
                <v-icon v-else size="60">mdi-account-circle</v-icon>
            </v-avatar>
            <v-file-input
              label="Upload a picture"
              variant="outlined"
              accept="image/*"
              @change="handleFileUpload"
              prepend-icon="mdi-camera"
            ></v-file-input>
          </v-col>
        </v-row>
        
        <v-divider class="my-6"></v-divider>

        <!-- Personal Information -->
        <h3 class="text-h6 font-weight-medium mb-4">Personal Information</h3>
        <v-row>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Last Name <span class="text-red">*</span></label>
              <v-text-field v-model="form.last_name" label="Enter last name" variant="outlined" :error-messages="v$.last_name.$errors.map(e => e.$message)" @blur="v$.last_name.$touch"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">First Name <span class="text-red">*</span></label>
              <v-text-field v-model="form.first_name" label="Enter first name" variant="outlined" :error-messages="v$.first_name.$errors.map(e => e.$message)" @blur="v$.first_name.$touch"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Middle Name (Optional)</label>
              <v-text-field v-model="form.middle_name" label="Enter middle name" variant="outlined"></v-text-field>
            </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">Birth Date <span class="text-red">*</span></label>
            <v-text-field v-model="form.birth_date" type="date" variant="outlined" :error-messages="v$.birth_date.$errors.map(e => e.$message)" @blur="v$.birth_date.$touch"></v-text-field>
          </v-col>
           <v-col cols="12" md="9">
            <label class="v-label mb-1">Birth Place (Optional)</label>
            <v-text-field v-model="form.birth_place" label="Enter birth place" variant="outlined"></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Sex <span class="text-red">*</span></label>
            <v-select v-model="form.sex" label="Select sex" :items="['Male', 'Female']" variant="outlined" :error-messages="v$.sex.$errors.map(e => e.$message)" @blur="v$.sex.$touch"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Civil Status <span class="text-red">*</span></label>
            <v-select v-model="form.civil_status" label="Select civil status" :items="['Single', 'Married', 'Widowed', 'Separated']" variant="outlined" :error-messages="v$.civil_status.$errors.map(e => e.$message)" @blur="v$.civil_status.$touch"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Religion (Optional)</label>
            <v-text-field v-model="form.religion" label="Enter religion" variant="outlined"></v-text-field>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>
        
        <!-- Contact Information -->
        <h3 class="text-h6 font-weight-medium mb-4">Contact Information</h3>
        <v-row>
          <v-col cols="12">
            <label class="v-label mb-1">Residence Address <span class="text-red">*</span></label>
            <v-text-field v-model="form.residence_address" label="Enter full residence address" variant="outlined" :error-messages="v$.residence_address.$errors.map(e => e.$message)" @blur="v$.residence_address.$touch"></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">Mobile Number <span class="text-red">*</span></label>
            <v-text-field v-model="form.mobile_number" label="Enter mobile number" variant="outlined" :error-messages="v$.mobile_number.$errors.map(e => e.$message)" @blur="v$.mobile_number.$touch"></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">Residence Telephone (Optional)</label>
            <v-text-field v-model="form.residence_telephone_no" label="Enter residence telephone" variant="outlined"></v-text-field>
          </v-col>
           <v-col cols="12" md="3">
            <label class="v-label mb-1">Barangay Hall Telephone (Optional)</label>
            <v-text-field v-model="form.barangay_hall_telephone_number" label="Enter hall telephone" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label mb-1">E-mail Address (Optional)</label>
            <v-text-field v-model="form.email_address" label="Enter e-mail address" variant="outlined" :error-messages="v$.email_address.$errors.map(e => e.$message)" @blur="v$.email_address.$touch"></v-text-field>
          </v-col>
        </v-row>
        
        <v-divider class="my-6"></v-divider>
        
        <!-- Educational & Occupation -->
        <h3 class="text-h6 font-weight-medium mb-4">Education & Occupation</h3>
        <v-row align="center">
          <v-col cols="12">
             <label class="v-label mb-1">Highest Educational Attainment</label>
             <v-radio-group v-model="form.highest_educational_attainment" inline>
                <v-radio label="Elementary" value="Elementary"></v-radio>
                <v-radio label="High School" value="High School"></v-radio>
                <v-radio label="College" value="College"></v-radio>
                <v-radio label="Post Grad" value="Post Grad"></v-radio>
                <v-radio label="Vocational" value="Vocational"></v-radio>
             </v-radio-group>
          </v-col>
          <v-col cols="12" md="4" v-if="form.highest_educational_attainment">
             <v-radio-group v-model="form.educational_attainment_status" inline>
                <v-radio label="Graduate" value="Graduate"></v-radio>
                <v-radio label="Undergraduate" value="Undergraduate"></v-radio>
             </v-radio-group>
          </v-col>
          <v-col cols="12" md="8" v-if="form.highest_educational_attainment">
            <v-text-field v-model="form.educational_attainment_details" label="Please specify (e.g., Course, Degree)" variant="outlined"></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Occupation (Optional)</label>
            <v-text-field v-model="form.occupation" label="Enter occupation" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Honorarium (Optional)</label>
            <v-text-field v-model="form.honorarium" label="Enter honorarium amount" variant="outlined" type="number" prefix="₱"></v-text-field>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>
        
        <!-- Official Position -->
        <h3 class="text-h6 font-weight-medium mb-4">Official Position</h3>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Position / Designation <span class="text-red">*</span></label>
            <v-select v-model="form.position" label="Select a position" :items="['Punong Barangay', 'Barangay Secretary', 'Treasurer', 'Sangguniang Barangay Member', 'SK Chairperson', 'SK Member']" variant="outlined" :error-messages="v$.position.$errors.map(e => e.$message)" @blur="v$.position.$touch"></v-select>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Term in Present Position <span class="text-red">*</span></label>
            <v-select v-model="form.term_in_present_position" label="Select term" :items="['1st', '2nd', '3rd']" variant="outlined" :error-messages="v$.term_in_present_position.$errors.map(e => e.$message)" @blur="v$.term_in_present_position.$touch"></v-select>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Term Start Date <span class="text-red">*</span></label>
            <v-text-field v-model="form.term_start" type="date" variant="outlined" :error-messages="v$.term_start.$errors.map(e => e.$message)" @blur="v$.term_start.$touch"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Term End Date (Optional)</label>
            <v-text-field v-model="form.term_end" label="Leave blank if currently serving" type="date" variant="outlined"></v-text-field>
          </v-col>
          <!-- <v-col cols="12" md="4">
            <label class="v-label mb-1">Status <span class="text-red">*</span></label>
            <v-select v-model="form.status" :items="['Active', 'Inactive']" variant="outlined" :error-messages="v$.status.$errors.map(e => e.$message)" @blur="v$.status.$touch"></v-select>
          </v-col> -->
        </v-row>

        <v-divider class="my-6"></v-divider>

        <!-- Beneficiaries -->
        <div class="d-flex justify-space-between align-center mb-4">
          <h3 class="text-h6 font-weight-medium">Beneficiaries</h3>
          <v-btn color="primary" @click="addBeneficiary" prepend-icon="mdi-plus">Add Beneficiary</v-btn>
        </div>
        <div v-if="form.beneficiaries.length === 0" class="text-center text-grey py-4">
          No beneficiaries added.
        </div>
        <v-card v-for="(beneficiary, index) in form.beneficiaries" :key="index" class="mb-4" variant="outlined">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="1" class="text-h6 text-grey-darken-1">{{ index + 1 }}.</v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="beneficiary.name" label="Name" variant="outlined"  hide-details></v-text-field>
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model="beneficiary.date_of_birth" label="Date of Birth" variant="outlined" type="date"  hide-details></v-text-field>
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model="beneficiary.relationship" label="Relationship" variant="outlined"  hide-details></v-text-field>
              </v-col>
              <v-col cols="12" md="1" class="text-right">
                <v-btn icon="mdi-delete" variant="text" color="error" @click="removeBeneficiary(index)"></v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

const form = reactive({
  first_name: '',
  last_name: '',
  middle_name: '',
  sex: null,
  civil_status: null,
  religion: '',
  term_in_present_position: null,
  position: null,
  term_start: '',
  term_end: '',
  status: 'Active',
  photo_url: null,
  // New Fields
  birth_date: '',
  birth_place: '',
  residence_address: '',
  residence_telephone_no: '',
  mobile_number: '',
  barangay_hall_telephone_number: '',
  email_address: '',
  highest_educational_attainment: null,
  educational_attainment_details: '',
  educational_attainment_status: null,
  occupation: '',
  honorarium: '',
  beneficiaries: [],
});

const saving = ref(false);

const rules = {
  first_name: { required },
  last_name: { required },
  sex: { required },
  civil_status: { required },
  position: { required },
  term_in_present_position: { required },
  term_start: { required },
  // status: { required },
  // New Rules
  birth_date: { required },
  residence_address: { required },
  mobile_number: { required },
  email_address: { email },
};

const v$ = useVuelidate(rules, form);

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    form.photo_url = e.target.result;
  };
  reader.readAsDataURL(file);
}

function addBeneficiary() {
  form.beneficiaries.push({ name: '', date_of_birth: '', relationship: '' });
}

function removeBeneficiary(index) {
  form.beneficiaries.splice(index, 1);
}

async function saveOfficial() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const { data, error } = await useMyFetch('/api/barangay-officials', {
      method: 'post', 
      body: form,
    });

    if (error.value) {
      throw new Error(error.value.data?.error || 'Failed to add official.');
    }

    $toast.fire({ title: 'Official added successfully!', icon: 'success' });
    router.push('/barangay-officials');

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
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
</style>