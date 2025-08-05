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
        <p class="text-subtitle-2 mb-4">Personal Information</p>
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label">First Name *</label>
            <v-text-field v-model="form.first_name" label="First Name *" variant="outlined" :error-messages="vHead$.first_name.$errors.map(e => e.$message)" @blur="vHead$.first_name.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Middle Name</label>
            <v-text-field v-model="form.middle_name" label="Middle Name" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Last Name *</label>
            <v-text-field v-model="form.last_name" label="Last Name *" variant="outlined" :error-messages="vHead$.last_name.$errors.map(e => e.$message)" @blur="vHead$.last_name.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label">Sex *</label>
            <v-select v-model="form.sex" :items="['Male', 'Female']" label="Sex *" variant="outlined" placeholder="Select Sex" :error-messages="vHead$.sex.$errors.map(e => e.$message)" @blur="vHead$.sex.$touch()"></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <label class="v-label">Date of Birth *</label>
            <v-text-field v-model="form.date_of_birth" label="Date of Birth *" type="date" variant="outlined" :error-messages="vHead$.date_of_birth.$errors.map(e => e.$message)" @blur="vHead$.date_of_birth.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="2">
            <label class="v-label">Age</label>
            <v-text-field :model-value="headCalculatedAge" label="Age" type="number" variant="outlined" readonly hint="Auto-calculated" persistent-hint></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Civil Status *</label>
            <v-select v-model="form.civil_status" :items="['Single', 'Married', 'Widowed', 'Separated']" label="Civil Status *" variant="outlined" placeholder="Select Civil Status" :error-messages="vHead$.civil_status.$errors.map(e => e.$message)" @blur="vHead$.civil_status.$touch()"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Citizenship *</label>
            <v-select v-model="form.citizenship" :items="['Filipino', 'Other']" label="Citizenship *" variant="outlined" placeholder="Select Citizenship" :error-messages="vHead$.citizenship.$errors.map(e => e.$message)" @blur="vHead$.citizenship.$touch()"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Occupation Status *</label>
            <v-select v-model="form.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)', 'Student', 'Retired', 'Not Applicable']" label="Occupation Status *" variant="outlined" :error-messages="vHead$.occupation_status.$errors.map(e => e.$message)" @blur="vHead$.occupation_status.$touch()"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Email Address *</label>
            <v-text-field v-model="form.email" label="Email Address *" type="email" variant="outlined" :error-messages="vHead$.email.$errors.map(e => e.$message)" @blur="vHead$.email.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Contact Number *</label>
            <v-text-field v-model="form.contact_number" label="Contact Number *" variant="outlined" maxlength="11" :error-messages="vHead$.contact_number.$errors.map(e => e.$message)" @blur="vHead$.contact_number.$touch()"></v-text-field>
          </v-col>
        </v-row>
        
        <v-divider class="my-6"></v-divider>
        <p class="text-subtitle-2 mb-4">Address Information</p>
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label">House Number/Lot/Block *</label>
            <v-text-field v-model="form.address_house_number" label="House Number/Lot/Block *" variant="outlined" :error-messages="vHead$.address_house_number.$errors.map(e => e.$message)" @blur="vHead$.address_house_number.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="8">
            <label class="v-label">Street *</label>
            <v-text-field v-model="form.address_street" label="Street *" variant="outlined" :error-messages="vHead$.address_street.$errors.map(e => e.$message)" @blur="vHead$.address_street.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Subdivision/Zone/Sitio/Purok *</label>
            <v-text-field v-model="form.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok *" variant="outlined" :error-messages="vHead$.address_subdivision_zone.$errors.map(e => e.$message)" @blur="vHead$.address_subdivision_zone.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">City/Municipality</label>
            <v-text-field v-model="form.address_city_municipality" label="City/Municipality" variant="outlined" readonly></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Years at Current Address *</label>
            <v-text-field v-model="form.years_at_current_address" label="Years at Current Address *" type="number" variant="outlined" :error-messages="vHead$.years_at_current_address.$errors.map(e => e.$message)" @blur="vHead$.years_at_current_address.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Upload Proof of Residency *</label>
            <v-file-input v-model="form.proof_of_residency_file" label="Upload Proof of Residency *" variant="outlined" accept="image/*,application/pdf" :error-messages="vHead$.proof_of_residency_file.$errors.map(e => e.$message)" show-size clearable @blur="vHead$.proof_of_residency_file.$touch()"></v-file-input>
             <v-img v-if="proofResidencyPreviewUrl" :src="proofResidencyPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>
        <p class="text-subtitle-2 mb-4">Voter Information</p>
        <v-row v-if="headCalculatedAge >= 18"><v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Voter?</label><v-radio-group v-model="form.is_voter" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
        <v-row v-if="form.is_voter && headCalculatedAge >= 18">
          <v-col cols="12" md="6">
            <label class="v-label">Voter's ID Number</label>
            <v-text-field v-model="form.voter_id_number" label="Voter's ID Number" variant="outlined" hint="Required if ID card is not uploaded." persistent-hint :error-messages="vHead$.voter_id_number.$errors.map(e => e.$message)" @blur="vHead$.voter_id_number.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Upload Voter's ID Card</label>
            <v-file-input v-model="form.voter_id_file" label="Upload Voter's ID Card" variant="outlined" accept="image/*,application/pdf" hint="Required if ID number is not provided." persistent-hint :error-messages="vHead$.voter_id_file.$errors.map(e => e.$message)" show-size clearable @blur="vHead$.voter_id_file.$touch()"></v-file-input>
            <v-img v-if="voterIdPreviewUrl" :src="voterIdPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>
        <p class="text-subtitle-2 mb-4">Special Classification</p>
        <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label><v-radio-group v-model="form.is_pwd" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
        <v-row v-if="form.is_pwd">
          <v-col cols="12" md="6">
            <label class="v-label">PWD ID Number</label>
            <v-text-field v-model="form.pwd_id" label="PWD ID Number" variant="outlined" hint="Required if PWD card is not uploaded." persistent-hint :error-messages="vHead$.pwd_id.$errors.map(e => e.$message)" @blur="vHead$.pwd_id.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Upload PWD ID Card</label>
            <v-file-input v-model="form.pwd_card_file" label="Upload PWD ID Card" variant="outlined" accept="image/*" hint="Required if PWD ID number is not provided." persistent-hint :error-messages="vHead$.pwd_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vHead$.pwd_card_file.$touch()"></v-file-input>
            <v-img v-if="pwdCardPreviewUrl" :src="pwdCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
          </v-col>
        </v-row>
        <v-row v-if="isHeadSenior">
          <v-divider class="my-4"></v-divider>
          <v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Senior Citizen? (Age 60+)</label><v-radio-group v-model="form.is_senior_citizen" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col>
          <template v-if="form.is_senior_citizen">
            <v-col cols="12" md="6">
              <label class="v-label">Senior Citizen ID Number</label>
              <v-text-field v-model="form.senior_citizen_id" label="Senior Citizen ID Number" variant="outlined" hint="Required if Senior card is not uploaded." persistent-hint :error-messages="vHead$.senior_citizen_id.$errors.map(e => e.$message)" @blur="vHead$.senior_citizen_id.$touch()"></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label">Upload Senior Citizen ID Card</label>
              <v-file-input v-model="form.senior_citizen_card_file" label="Upload Senior Citizen ID Card" variant="outlined" accept="image/*" hint="Required if Senior ID number is not provided." persistent-hint :error-messages="vHead$.senior_citizen_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vHead$.senior_citizen_card_file.$touch()"></v-file-input>
              <v-img v-if="seniorCardPreviewUrl" :src="seniorCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
            </v-col>
          </template>
        </v-row>

        <v-divider class="my-6"></v-divider>
        <p class="text-subtitle-2 mb-4">Account Credentials</p>
        <v-alert type="info" variant="tonal" class="mb-4">
            <strong>Disclaimer:</strong> You must be 15 years old or above to create an account.
        </v-alert>
        <v-row>
            <v-col cols="12" sm="6">
              <label class="v-label">Password *</label>
              <v-text-field v-model="form.password" label="Password *" :type="showHeadPassword ? 'text' : 'password'" variant="outlined" hint="Minimum 6 characters" persistent-hint :error-messages="vHead$.password.$errors.map(e => e.$message)" @blur="vHead$.password.$touch()" :append-inner-icon="showHeadPassword ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="showHeadPassword = !showHeadPassword"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <label class="v-label">Confirm Password *</label>
              <v-text-field v-model="form.confirmPassword" label="Confirm Password *" :type="showHeadConfirmPassword ? 'text' : 'password'" variant="outlined" :error-messages="vHead$.confirmPassword.$errors.map(e => e.$message)" @blur="vHead$.confirmPassword.$touch()" :append-inner-icon="showHeadConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="showHeadConfirmPassword = !showHeadConfirmPassword"></v-text-field>
            </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Household Members Section -->
    <v-card class="mb-6" flat border>
      <v-card-title class="text-h6 font-weight-medium d-flex justify-space-between align-center">
        <span>Step 2: Household Members</span>
        <v-btn color="primary" variant="tonal" @click="openMemberDialog()" prepend-icon="mdi-account-plus">Add New Member</v-btn>
      </v-card-title>
      <v-card-text>
        <v-table v-if="form.household_members_to_create.length > 0">
          <thead><tr><th class="text-left">Name</th><th class="text-left">Relationship</th><th class="text-left">Age</th><th class="text-left">Actions</th></tr></thead>
          <tbody>
            <tr v-for="(member, index) in form.household_members_to_create" :key="index">
              <td>{{ member.first_name }} {{ member.last_name }}</td><td>{{ member.relationship_to_head === 'Other' ? member.other_relationship : member.relationship_to_head }}</td><td>{{ calculateAge(member.date_of_birth) }}</td>
              <td>
                <v-btn icon="mdi-pencil-outline" variant="text" color="primary" size="small" @click="openMemberDialog(index)"></v-btn>
                <v-btn icon="mdi-delete-outline" variant="text" color="error" size="small" @click="removeMember(index)"></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-center text-grey py-4">No members have been added yet.</p>
      </v-card-text>
    </v-card>

    <!-- REVISION: The Member Form Dialog now mirrors the Head's form (without address) -->
    <v-dialog v-model="showMemberDialog" persistent max-width="900px" scrollable>
      <v-card>
        <v-card-title class="text-h5">{{ editingMemberIndex === null ? 'Add New' : 'Edit' }} Household Member</v-card-title>
        <v-card-text>
          <p class="text-subtitle-2 mb-4">Personal Information</p>
          <v-row>
            <v-col cols="12" md="4">
              <label class="v-label">First Name *</label>
              <v-text-field v-model="memberForm.first_name" label="First Name *" variant="outlined" :error-messages="vMember$.first_name.$errors.map(e => e.$message)" @blur="vMember$.first_name.$touch()"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Middle Name</label>
              <v-text-field v-model="memberForm.middle_name" label="Middle Name" variant="outlined"></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Last Name *</label>
              <v-text-field v-model="memberForm.last_name" label="Last Name *" variant="outlined" :error-messages="vMember$.last_name.$errors.map(e => e.$message)" @blur="vMember$.last_name.$touch()"></v-text-field>
            </v-col>
            
            <v-col cols="12" md="4">
              <label class="v-label">Relationship to Head *</label>
              <v-select v-model="memberForm.relationship_to_head" :items="relationshipOptions" label="Relationship to Head *" variant="outlined" :error-messages="vMember$.relationship_to_head.$errors.map(e => e.$message)" @blur="vMember$.relationship_to_head.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="8" v-if="memberForm.relationship_to_head === 'Other'">
                <label class="v-label">Please Specify Relationship *</label>
                <v-text-field v-model="memberForm.other_relationship" label="Please Specify Relationship *" variant="outlined" :error-messages="vMember$.other_relationship.$errors.map(e => e.$message)" @blur="vMember$.other_relationship.$touch()"></v-text-field>
            </v-col>

            <v-col cols="12" md="3">
              <label class="v-label">Sex *</label>
              <v-select v-model="memberForm.sex" :items="['Male', 'Female']" label="Sex *" variant="outlined" placeholder="Select Sex" :error-messages="vMember$.sex.$errors.map(e => e.$message)" @blur="vMember$.sex.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <label class="v-label">Date of Birth *</label>
              <v-text-field v-model="memberForm.date_of_birth" label="Date of Birth *" type="date" variant="outlined" :error-messages="vMember$.date_of_birth.$errors.map(e => e.$message)" @blur="vMember$.date_of_birth.$touch()"></v-text-field>
            </v-col>
            <v-col cols="12" md="2">
              <label class="v-label">Age</label>
              <v-text-field :model-value="memberAge" label="Age" type="number" variant="outlined" readonly></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Civil Status *</label>
              <v-select v-model="memberForm.civil_status" :items="['Single', 'Married', 'Widowed', 'Separated']" label="Civil Status *" variant="outlined" placeholder="Select Civil Status" :error-messages="vMember$.civil_status.$errors.map(e => e.$message)" @blur="vMember$.civil_status.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Citizenship *</label>
              <v-select v-model="memberForm.citizenship" :items="['Filipino', 'Other']" label="Citizenship *" variant="outlined" placeholder="Select Citizenship" :error-messages="vMember$.citizenship.$errors.map(e => e.$message)" @blur="vMember$.citizenship.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Occupation Status *</label>
              <v-select v-model="memberForm.occupation_status" :items="['Labor force', 'Unemployed', 'Out of School Youth (OSY)', 'Student', 'Retired', 'Not Applicable']" label="Occupation Status *" variant="outlined" :error-messages="vMember$.occupation_status.$errors.map(e => e.$message)" @blur="vMember$.occupation_status.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label">Contact Number</label>
              <v-text-field v-model="memberForm.contact_number" label="Contact Number" variant="outlined"></v-text-field>
            </v-col>
          </v-row>
          
          <v-divider class="my-6"></v-divider>
          <p class="text-subtitle-2 mb-4">Voter Information</p>
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Voter?</label><v-radio-group v-model="memberForm.is_voter" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="memberForm.is_voter">
            <v-col cols="12" md="6">
              <label class="v-label">Voter's ID Number</label>
              <v-text-field v-model="memberForm.voter_id_number" label="Voter's ID Number" variant="outlined" hint="Required if ID card is not uploaded." persistent-hint :error-messages="vMember$.voter_id_number.$errors.map(e => e.$message)" @blur="vMember$.voter_id_number.$touch()"></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label">Upload Voter's ID Card</label>
              <v-file-input v-model="memberForm.voter_id_file" label="Upload Voter's ID Card" variant="outlined" accept="image/*,application/pdf" hint="Required if ID number is not provided." persistent-hint :error-messages="vMember$.voter_id_file.$errors.map(e => e.$message)" show-size clearable @blur="vMember$.voter_id_file.$touch()"></v-file-input>
              <v-img v-if="memberVoterIdPreviewUrl" :src="memberVoterIdPreviewUrl" class="mt-2" max-height="150" contain></v-img>
            </v-col>
          </v-row>
          
          <v-divider class="my-6"></v-divider>
          <p class="text-subtitle-2 mb-4">Special Classification</p>
          <v-row><v-col cols="12"><label class="v-label font-weight-medium mb-1">Person with Disability (PWD)?</label><v-radio-group v-model="memberForm.is_pwd" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col></v-row>
          <v-row v-if="memberForm.is_pwd">
            <v-col cols="12" md="6">
              <label class="v-label">PWD ID Number</label>
              <v-text-field v-model="memberForm.pwd_id" label="PWD ID Number" variant="outlined" hint="Required if PWD card is not uploaded." persistent-hint :error-messages="vMember$.pwd_id.$errors.map(e => e.$message)" @blur="vMember$.pwd_id.$touch()"></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label">Upload PWD ID Card</label>
              <v-file-input v-model="memberForm.pwd_card_file" label="Upload PWD ID Card" variant="outlined" accept="image/*" hint="Required if PWD ID number is not provided." persistent-hint :error-messages="vMember$.pwd_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vMember$.pwd_card_file.$touch()"></v-file-input>
              <v-img v-if="memberPwdCardPreviewUrl" :src="memberPwdCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
            </v-col>
          </v-row>
          <v-row v-if="isMemberSenior">
            <v-divider class="my-4"></v-divider>
            <v-col cols="12"><label class="v-label font-weight-medium mb-1">Registered Senior Citizen? (Age 60+)</label><v-radio-group v-model="memberForm.is_senior_citizen" inline><v-radio label="No" :value="false"></v-radio><v-radio label="Yes" :value="true"></v-radio></v-radio-group></v-col>
            <template v-if="memberForm.is_senior_citizen">
              <v-col cols="12" md="6">
                <label class="v-label">Senior Citizen ID Number</label>
                <v-text-field v-model="memberForm.senior_citizen_id" label="Senior Citizen ID Number" variant="outlined" hint="Required if Senior card is not uploaded." persistent-hint :error-messages="vMember$.senior_citizen_id.$errors.map(e => e.$message)" @blur="vMember$.senior_citizen_id.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label">Upload Senior Citizen ID Card</label>
                <v-file-input v-model="memberForm.senior_citizen_card_file" label="Upload Senior Citizen ID Card" variant="outlined" accept="image/*" hint="Required if Senior ID number is not provided." persistent-hint :error-messages="vMember$.senior_citizen_card_file.$errors.map(e => e.$message)" show-size clearable @blur="vMember$.senior_citizen_card_file.$touch()"></v-file-input>
                <v-img v-if="memberSeniorCardPreviewUrl" :src="memberSeniorCardPreviewUrl" class="mt-2" max-height="150" contain></v-img>
              </v-col>
            </template>
          </v-row>
          
          <!-- <template v-if="memberAge >= 15">
            <v-divider class="my-6"></v-divider>
            <p class="text-subtitle-2 mb-4">Account Creation (Optional, for ages 15+)</p>
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label">Email Address</label>
                <v-text-field v-model="memberForm.email" label="Email Address" type="email" variant="outlined" hint="Required if creating an account" persistent-hint :error-messages="vMember$.email.$errors.map(e => e.$message)" @blur="vMember$.email.$touch()"></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label">Password</label>
                <v-text-field v-model="memberForm.password" label="Password" :type="showMemberPassword ? 'text' : 'password'" variant="outlined" hint="Required if creating an account" persistent-hint :error-messages="vMember$.password.$errors.map(e => e.$message)" @blur="vMember$.password.$touch()" :append-inner-icon="showMemberPassword ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="showMemberPassword = !showMemberPassword"></v-text-field>
              </v-col>
            </v-row>
          </template> -->

        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="closeMemberDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveMember">{{ editingMemberIndex === null ? 'Add Member' : 'Save Changes' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers, numeric, alpha } from '@vuelidate/validators';
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const saving = ref(false);
const showHeadPassword = ref(false);
const showHeadConfirmPassword = ref(false);
const showMemberPassword = ref(false);

const form = reactive({
  first_name: '', middle_name: '', last_name: '', sex: null, date_of_birth: '',
  civil_status: null, citizenship: 'Filipino', occupation_status: null, email: '', contact_number: '',
  password: '', confirmPassword: '',
  address_house_number: '', address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  years_at_current_address: null, proof_of_residency_file: null,
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
  household_members_to_create: [],
});

const voterIdPreviewUrl = ref(null);
const pwdCardPreviewUrl = ref(null);
const seniorCardPreviewUrl = ref(null);
const proofResidencyPreviewUrl = ref(null);

const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  let age = new Date().getFullYear() - birthDate.getFullYear();
  const m = new Date().getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
};

const headCalculatedAge = computed(() => calculateAge(form.date_of_birth));
const isHeadSenior = computed(() => headCalculatedAge.value !== null && headCalculatedAge.value >= 60);

const headRules = {
  first_name: { 
  required, 
  alpha: helpers.withMessage('Only alphabetic characters and spaces are allowed.', helpers.regex(/^[a-zA-Z\s]*$/)) 
},
middle_name: { 
  alpha: helpers.withMessage('Only alphabetic characters and spaces are allowed.', helpers.regex(/^[a-zA-Z\s]*$/)) 
},
last_name: { 
  required, 
  alpha: helpers.withMessage('Only alphabetic characters and spaces are allowed.', helpers.regex(/^[a-zA-Z\s]*$/)) 
},
  sex: { required }, date_of_birth: { required },
  civil_status: { required }, citizenship: { required }, occupation_status: { required },
  email: { required, email }, contact_number: { required },
  password: { required, minLength: minLength(6) },
  confirmPassword: { required, sameAs: helpers.withMessage('Passwords do not match.', sameAs(computed(() => form.password))) },
  address_house_number: { required, numeric }, address_street: { required }, address_subdivision_zone: { required },
  years_at_current_address: { required, numeric }, proof_of_residency_file: { required: helpers.withMessage('Proof of Residency is required.', required) },
  // REVISED VALIDATION
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => form.is_voter && !form.voter_id_file)) },
  voter_id_file: { requiredIf: helpers.withMessage("Voter's ID Card or Number is required.", requiredIf(() => form.is_voter && !form.voter_id_number)) },
  pwd_id: { requiredIf: helpers.withMessage('PWD ID Number or Card is required.', requiredIf(() => form.is_pwd && !form.pwd_card_file)) },
  pwd_card_file: { requiredIf: helpers.withMessage('PWD Card or ID Number is required.', requiredIf(() => form.is_pwd && !form.pwd_id)) },
  // senior_citizen_id: { requiredIf: helpers.withMessage('Senior Citizen ID Number or Card is required.', requiredIf(() => form.is_senior_citizen && !form.senior_citizen_card_file)) },
  // senior_citizen_card_file: { requiredIf: helpers.withMessage('Senior Citizen Card or ID Number is required.', requiredIf(() => form.is_senior_citizen && !form.senior_citizen_id)) },
};
const vHead$ = useVuelidate(headRules, form);

const showMemberDialog = ref(false);
const editingMemberIndex = ref(null);

const relationshipOptions = [
  'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 
  'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Nephew', 'Niece', 'In-law', 
  'Household Help / Kasambahay', 'Other'
];

const getInitialMemberForm = () => ({
  first_name: '', middle_name: '', last_name: '',
  relationship_to_head: null, other_relationship: '',
  sex: null, date_of_birth: '', civil_status: null, citizenship: 'Filipino',
  occupation_status: null, contact_number: '', email: '', password: '',
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
});

const memberForm = reactive(getInitialMemberForm());

const memberVoterIdPreviewUrl = ref(null);
const memberPwdCardPreviewUrl = ref(null);
const memberSeniorCardPreviewUrl = ref(null);

const memberAge = computed(() => calculateAge(memberForm.date_of_birth));
const isMemberSenior = computed(() => memberAge.value !== null && memberAge.value >= 60);

const memberRules = {
  first_name: { required }, last_name: { required },
  relationship_to_head: { required },
  other_relationship: { requiredIf: helpers.withMessage('Please specify the relationship.', requiredIf(() => memberForm.relationship_to_head === 'Other')) },
  sex: { required }, date_of_birth: { required }, civil_status: { required },
  citizenship: { required }, occupation_status: { required },
  email: { requiredIf: requiredIf(() => !!memberForm.password), email },
  password: { requiredIf: requiredIf(() => !!memberForm.email), minLength: minLength(6) },
  // REVISED VALIDATION
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => memberForm.is_voter && !memberForm.voter_id_file)) },
  voter_id_file: { requiredIf: helpers.withMessage("Voter's ID Card or Number is required.", requiredIf(() => memberForm.is_voter && !memberForm.voter_id_number)) },
  pwd_id: { requiredIf: helpers.withMessage('PWD ID Number or Card is required.', requiredIf(() => memberForm.is_pwd && !memberForm.pwd_card_file)) },
  pwd_card_file: { requiredIf: helpers.withMessage('PWD Card or ID Number is required.', requiredIf(() => memberForm.is_pwd && !memberForm.pwd_id)) },
  senior_citizen_id: { requiredIf: helpers.withMessage('Senior Citizen ID Number or Card is required.', requiredIf(() => memberForm.is_senior_citizen && !memberForm.senior_citizen_card_file)) },
  senior_citizen_card_file: { requiredIf: helpers.withMessage('Senior Citizen Card or ID Number is required.', requiredIf(() => memberForm.is_senior_citizen && !memberForm.senior_citizen_id)) },
};
const vMember$ = useVuelidate(memberRules, memberForm);

const urlCreator = (file) => file ? URL.createObjectURL(file) : null;

watch(() => form.voter_id_file, (newFile) => { voterIdPreviewUrl.value = urlCreator(newFile); });
watch(() => form.pwd_card_file, (newFile) => { pwdCardPreviewUrl.value = urlCreator(newFile); });
watch(() => form.senior_citizen_card_file, (newFile) => { seniorCardPreviewUrl.value = urlCreator(newFile); });
watch(() => form.proof_of_residency_file, (newFile) => { proofResidencyPreviewUrl.value = urlCreator(newFile); });

watch(() => memberForm.voter_id_file, (newFile) => { memberVoterIdPreviewUrl.value = urlCreator(newFile); });
watch(() => memberForm.pwd_card_file, (newFile) => { memberPwdCardPreviewUrl.value = urlCreator(newFile); });
watch(() => memberForm.senior_citizen_card_file, (newFile) => { memberSeniorCardPreviewUrl.value = urlCreator(newFile); });

const openMemberDialog = (index = null) => { 
  if (index !== null) {
    editingMemberIndex.value = index;
    Object.assign(memberForm, form.household_members_to_create[index]);
  } else {
    editingMemberIndex.value = null;
  }
  showMemberDialog.value = true;
};

const closeMemberDialog = () => {
    showMemberDialog.value = false;
    editingMemberIndex.value = null;
    vMember$.value.$reset();
    Object.assign(memberForm, getInitialMemberForm());
    memberVoterIdPreviewUrl.value = null;
    memberPwdCardPreviewUrl.value = null;
    memberSeniorCardPreviewUrl.value = null;
    showMemberPassword.value = false;
};

const saveMember = async () => {
  const isFormCorrect = await vMember$.value.$validate();
  if (!isFormCorrect) return;

  if (editingMemberIndex.value !== null) {
    form.household_members_to_create[editingMemberIndex.value] = { ...memberForm };
  } else {
    form.household_members_to_create.push({ ...memberForm });
  }
  closeMemberDialog();
};

const removeMember = (index) => { form.household_members_to_create.splice(index, 1); };


const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    // If the file is null or undefined, resolve immediately.
    if (!file) { 
      resolve(null); 
      return; 
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    // Pass the file object directly.
    reader.readAsDataURL(file); 
  });
};

async function saveResidentAndHousehold() {
  const isFormCorrect = await vHead$.value.$validate();
  
  if (!isFormCorrect) { 
    $toast.fire({ title: 'Please correct all errors for the Household Head.', icon: 'error' }); 
    return; 
  }
  
  if (headCalculatedAge.value < 15) {
    $toast.fire({ title: 'Household Head must be at least 15 years old to register.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const payload = JSON.parse(JSON.stringify(form));
    payload.age = headCalculatedAge.value;
    payload.is_household_head = true;
    
    // Set status for the Household Head
    payload.status = 'Approved';
    payload.date_approved = new Date().toISOString();
    
    [
      payload.voter_registration_proof_base64,
      payload.pwd_card_base64,
      payload.senior_citizen_card_base64,
      payload.proof_of_residency_base64
    ] = await Promise.all([
      convertFileToBase64(form.voter_id_file),
      convertFileToBase64(form.pwd_card_file),
      convertFileToBase64(form.senior_citizen_card_file),
      convertFileToBase64(form.proof_of_residency_file)
    ]);
    
    // --- KEY CHANGES START HERE ---
    // Loop through members and set their status to 'Approved'
    for (const member of payload.household_members_to_create) {
        // 1. Set status for each member
        member.status = 'Approved';
        member.date_approved = new Date().toISOString();

        [
            member.voter_registration_proof_base64,
            member.pwd_card_base64,
            member.senior_citizen_card_base64
        ] = await Promise.all([
            convertFileToBase64(member.voter_id_file),
            convertFileToBase64(member.pwd_card_file),
            convertFileToBase64(member.senior_citizen_card_file)
        ]);

        delete member.voter_id_file;
        delete member.pwd_card_file;
        delete member.senior_citizen_card_file;
    }
    // --- KEY CHANGES END HERE ---
    
    delete payload.voter_id_file;
    delete payload.pwd_card_file;
    delete payload.senior_citizen_card_file;
    delete payload.proof_of_residency_file;
    delete payload.confirmPassword;
    
    const { data, error } = await useMyFetch("/api/admin/residents", { method: 'post', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Error registering household.');
    
    $toast.fire({ title: 'Household registered successfully! All accounts are now active.', icon: 'success' });
    
    // 2. Correct the redirect path
    router.push('/residents-account-management');

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