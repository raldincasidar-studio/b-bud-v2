<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">New Household Registration</h2>
        <p class="text-grey-darken-1">Register the Household Head and add all members in a single transaction.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn size="large" @click="saveResidentAndHousehold" prepend-icon="mdi-content-save-all" color="primary" :loading="saving">
          Save Household
        </v-btn>
      </v-col>
    </v-row>

    <!-- Head's Information Card -->
    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium">Step 1: Household Head Information</v-card-title>
      <v-card-text class="pt-4">
        <v-row>
          <v-col cols="12" md="4"><v-text-field v-model="form.first_name" label="First Name*" variant="outlined" :error-messages="vHead$.first_name.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="4"><v-text-field v-model="form.middle_name" label="Middle Name" variant="outlined"></v-text-field></v-col>
          <v-col cols="12" md="4"><v-text-field v-model="form.last_name" label="Last Name*" variant="outlined" :error-messages="vHead$.last_name.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="3"><v-select v-model="form.sex" :items="['Male', 'Female']" label="Sex*" variant="outlined" :error-messages="vHead$.sex.$errors.map(e => e.$message)"></v-select></v-col>
          <v-col cols="12" md="3"><v-text-field v-model="form.date_of_birth" label="Date of Birth*" type="date" variant="outlined" :error-messages="vHead$.date_of_birth.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="3"><v-text-field :model-value="headCalculatedAge" label="Age" type="number" variant="outlined" readonly hint="Auto-calculated" persistent-hint></v-text-field></v-col>
          <v-col cols="12" md="3"><v-select v-model="form.civil_status" :items="['Single', 'Married', 'Widowed']" label="Civil Status*" variant="outlined" :error-messages="vHead$.civil_status.$errors.map(e => e.$message)"></v-select></v-col>
          <v-col cols="12" md="4"><v-select v-model="form.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)']" label="Occupation Status*" variant="outlined" :error-messages="vHead$.occupation_status.$errors.map(e => e.$message)"></v-select></v-col>
          <v-col cols="12" md="4"><v-text-field v-model="form.email" label="Email Address*" type="email" variant="outlined" :error-messages="vHead$.email.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="4"><v-text-field v-model="form.contact_number" label="Contact Number*" variant="outlined" :error-messages="vHead$.contact_number.$errors.map(e => e.$message)"></v-text-field></v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium">Address Information</v-card-title>
      <v-card-text class="pt-4">
        <v-row>
          <v-col cols="12" md="4"><v-text-field v-model="form.address_house_number" label="House Number/Lot/Block*" variant="outlined" :error-messages="vHead$.address_house_number.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="8"><v-text-field v-model="form.address_street" label="Street*" variant="outlined" :error-messages="vHead$.address_street.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="6"><v-text-field v-model="form.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok*" variant="outlined" :error-messages="vHead$.address_subdivision_zone.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="6"><v-text-field v-model="form.address_city_municipality" label="City/Municipality" variant="outlined" readonly></v-text-field></v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium">Voter Information</v-card-title>
      <v-card-text class="pt-2">
        <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Voter?</label><v-radio-group v-model="form.is_voter" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
        <v-row v-if="form.is_voter">
          <v-col cols="12" md="6"><v-text-field v-model="form.voter_id_number" label="Voter's ID Number" variant="outlined" hint="Required if ID card is not uploaded." persistent-hint :error-messages="vHead$.voter_id_number.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="6">
            <v-file-input v-model="form.voter_id_file" label="Upload Voter's ID Card" variant="outlined" accept="image/*,application/pdf" hint="Required if ID number is not provided." persistent-hint :error-messages="vHead$.voter_id_file.$errors.map(e => e.$message)" show-size clearable></v-file-input>
            <v-img v-if="voterIdPreviewUrl" :src="voterIdPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium">Special Classification</v-card-title>
      <v-card-text class="pt-2">
        <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label><v-radio-group v-model="form.is_pwd" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
        <v-row v-if="form.is_pwd">
          <v-col cols="12" md="6"><v-text-field v-model="form.pwd_id" label="PWD ID Number*" variant="outlined" :error-messages="vHead$.pwd_id.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="6">
            <v-file-input v-model="form.pwd_card_file" label="Upload PWD ID Card*" variant="outlined" accept="image/*" :error-messages="vHead$.pwd_card_file.$errors.map(e => e.$message)" show-size clearable></v-file-input>
            <v-img v-if="pwdCardPreviewUrl" :src="pwdCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>
        <v-row v-if="isHeadSenior">
          <v-divider class="my-4"></v-divider>
          <v-col cols="12"><p class="text-subtitle-1 font-weight-medium">Senior Citizen Information (Age 60+)</p></v-col>
          <v-col cols="12" md="6"><v-text-field v-model="form.senior_citizen_id" label="Senior Citizen ID Number*" variant="outlined" :error-messages="vHead$.senior_citizen_id.$errors.map(e => e.$message)"></v-text-field></v-col>
          <v-col cols="12" md="6">
            <v-file-input v-model="form.senior_citizen_card_file" label="Upload Senior Citizen ID Card*" variant="outlined" accept="image/*" :error-messages="vHead$.senior_citizen_card_file.$errors.map(e => e.$message)" show-size clearable></v-file-input>
            <v-img v-if="seniorCardPreviewUrl" :src="seniorCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-6" flat border>
        <v-card-title class="text-h6 font-weight-medium">Account Credentials</v-card-title>
        <v-card-text class="pt-4">
          <v-row>
            <v-col cols="12" sm="6"><v-text-field v-model="form.password" label="Password*" type="password" variant="outlined" hint="Minimum 6 characters" persistent-hint :error-messages="vHead$.password.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" sm="6"><v-text-field v-model="form.confirmPassword" label="Confirm Password*" type="password" variant="outlined" :error-messages="vHead$.confirmPassword.$errors.map(e => e.$message)"></v-text-field></v-col>
          </v-row>
        </v-card-text>
    </v-card>

    <!-- Household Members Section -->
    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium d-flex justify-space-between align-center">
        <span>Step 2: Household Members</span>
        <v-btn color="primary" variant="tonal" @click="openMemberDialog" prepend-icon="mdi-account-plus">Add New Member</v-btn>
      </v-card-title>
      <v-card-text>
        <v-table v-if="form.household_members_to_create.length > 0">
          <thead><tr><th class="text-left">Name</th><th class="text-left">Relationship</th><th class="text-left">Age</th><th class="text-left">Actions</th></tr></thead>
          <tbody>
            <tr v-for="(member, index) in form.household_members_to_create" :key="index">
              <td>{{ member.first_name }} {{ member.last_name }}</td><td>{{ member.relationship_to_head }}</td><td>{{ member.age }}</td>
              <td><v-btn icon="mdi-delete-outline" variant="text" color="error" size="small" @click="removeMember(index)"></v-btn></td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-center text-grey py-4">No members have been added yet.</p>
      </v-card-text>
    </v-card>

    <!-- The Member Form Dialog -->
    <v-dialog v-model="showMemberDialog" persistent max-width="900px">
      <v-card>
        <v-card-title class="text-h5">Add New Household Member</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4"><v-text-field v-model="memberForm.first_name" label="First Name*" variant="outlined" :error-messages="vMember$.first_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="memberForm.middle_name" label="Middle Name" variant="outlined"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="memberForm.last_name" label="Last Name*" variant="outlined" :error-messages="vMember$.last_name.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="memberForm.relationship_to_head" label="Relationship to Head*" variant="outlined" :error-messages="vMember$.relationship_to_head.$errors.map(e => e.$message)"></v-text-field></v-col>
            <v-col cols="12" md="4"><v-select v-model="memberForm.sex" :items="['Male', 'Female']" label="Sex*" variant="outlined" :error-messages="vMember$.sex.$errors.map(e => e.$message)"></v-select></v-col>
            <v-col cols="12" md="4"><v-text-field v-model="memberForm.date_of_birth" label="Date of Birth*" type="date" variant="outlined" :error-messages="vMember$.date_of_birth.$errors.map(e => e.$message)"></v-text-field></v-col>
            <template v-if="memberAge >= 16">
              <v-divider class="my-4 w-100"></v-divider>
              <v-col cols="12"><p class="text-subtitle-1">Account Creation (Age 16+)</p></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="memberForm.email" label="Email Address*" type="email" variant="outlined" :error-messages="vMember$.email.$errors.map(e => e.$message)"></v-text-field></v-col>
              <v-col cols="12" md="6"><v-text-field v-model="memberForm.password" label="Password*" type="password" variant="outlined" :error-messages="vMember$.password.$errors.map(e => e.$message)"></v-text-field></v-col>
            </template>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="closeMemberDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveMember">Add Member to List</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers } from '@vuelidate/validators';
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const saving = ref(false);

const form = reactive({
  first_name: '', middle_name: '', last_name: '', sex: null, date_of_birth: '',
  civil_status: null, occupation_status: null, email: '', contact_number: '',
  password: '', confirmPassword: '',
  address_house_number: '', address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  senior_citizen_id: '', senior_citizen_card_file: null,
  household_members_to_create: [],
});

const voterIdPreviewUrl = ref(null);
const pwdCardPreviewUrl = ref(null);
const seniorCardPreviewUrl = ref(null);

const headCalculatedAge = computed(() => {
  if (!form.date_of_birth) return null;
  const birthDate = new Date(form.date_of_birth);
  if (isNaN(birthDate.getTime())) return null;
  let age = new Date().getFullYear() - birthDate.getFullYear();
  const m = new Date().getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
});
const isHeadSenior = computed(() => headCalculatedAge.value !== null && headCalculatedAge.value >= 60);

const headRules = {
  first_name: { required }, last_name: { required }, sex: { required }, date_of_birth: { required },
  civil_status: { required }, occupation_status: { required },
  email: { required, email }, contact_number: { required },
  password: { required, minLength: minLength(6) },
  confirmPassword: { required, sameAs: helpers.withMessage('Passwords do not match.', sameAs(computed(() => form.password))) },
  address_house_number: { required }, address_street: { required }, address_subdivision_zone: { required },
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => form.is_voter && !form.voter_id_file)) },
  voter_id_file: {},
  pwd_id: { requiredIf: helpers.withMessage('PWD ID is required.', requiredIf(() => form.is_pwd)) },
  pwd_card_file: { requiredIf: helpers.withMessage('PWD Card upload is required.', requiredIf(() => form.is_pwd)) },
  senior_citizen_id: { requiredIf: helpers.withMessage('Senior ID is required for age 60+.', requiredIf(isHeadSenior)) },
  senior_citizen_card_file: { requiredIf: helpers.withMessage('Senior Card upload is required for age 60+.', requiredIf(isHeadSenior)) },
};
const vHead$ = useVuelidate(headRules, form);

const showMemberDialog = ref(false);
const memberForm = reactive({
  first_name: '', middle_name: '', last_name: '', relationship_to_head: '',
  sex: null, date_of_birth: '', email: '', password: ''
});
const memberAge = computed(() => {
  if (!memberForm.date_of_birth) return 0;
  let age = new Date().getFullYear() - new Date(memberForm.date_of_birth).getFullYear();
  const m = new Date().getMonth() - new Date(memberForm.date_of_birth).getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < new Date(memberForm.date_of_birth).getDate())) age--;
  return age;
});
const memberRules = {
  first_name: { required }, last_name: { required }, relationship_to_head: { required },
  sex: { required }, date_of_birth: { required },
  email: { requiredIf: helpers.withMessage('Email is required for members 16+.', requiredIf(() => memberAge.value >= 16)), email },
  password: { requiredIf: helpers.withMessage('Password is required for members 16+.', requiredIf(() => memberAge.value >= 16)), minLength: minLength(6) }
};
const vMember$ = useVuelidate(memberRules, memberForm);

watch(() => form.voter_id_file, (newFile) => { voterIdPreviewUrl.value = newFile ? URL.createObjectURL(newFile) : null; });
watch(() => form.pwd_card_file, (newFile) => { pwdCardPreviewUrl.value = newFile ? URL.createObjectURL(newFile) : null; });
watch(() => form.senior_citizen_card_file, (newFile) => { seniorCardPreviewUrl.value = newFile ? URL.createObjectURL(newFile) : null; });

const openMemberDialog = () => { showMemberDialog.value = true; };
const closeMemberDialog = () => {
    showMemberDialog.value = false;
    vMember$.value.$reset();
    Object.assign(memberForm, { first_name: '', middle_name: '', last_name: '', relationship_to_head: '', sex: null, date_of_birth: '', email: '', password: '' });
};
const saveMember = async () => {
  const isFormCorrect = await vMember$.value.$validate();
  if (!isFormCorrect) return;
  form.household_members_to_create.push({ ...memberForm, age: memberAge.value });
  closeMemberDialog();
};
const removeMember = (index) => { form.household_members_to_create.splice(index, 1); };

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

async function saveResidentAndHousehold() {
  const isFormCorrect = await vHead$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct all errors for the Household Head.', icon: 'error' }); return; }

  saving.value = true;
  try {
    const payload = { ...form };
    payload.age = headCalculatedAge.value;
    payload.is_household_head = true;
    
    [
      payload.voter_registration_proof_base64,
      payload.pwd_card_base64,
      payload.senior_citizen_card_base64
    ] = await Promise.all([
      convertFileToBase64(form.voter_id_file),
      convertFileToBase64(form.pwd_card_file),
      convertFileToBase64(form.senior_citizen_card_file)
    ]);
    
    delete payload.voter_id_file;
    delete payload.pwd_card_file;
    delete payload.senior_citizen_card_file;
    delete payload.confirmPassword;
    
    const { data, error } = await useMyFetch("/api/residents", { method: 'post', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Error registering household.');
    
    $toast.fire({ title: 'Household registered successfully! All accounts are pending approval.', icon: 'success' });
    router.push('/residents');
  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
</style>