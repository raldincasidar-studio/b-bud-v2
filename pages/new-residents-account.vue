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
          <!-- New Suffix Field for Head -->
          <v-col cols="12" md="4">
            <label class="v-label">Suffix</label>
            <v-select v-model="form.suffix" :items="suffixOptions" label="Suffix" variant="outlined" clearable></v-select>
          </v-col>
          <!-- End New Suffix Field -->

          <v-col cols="12" md="4">
            <label class="v-label">Sex *</label>
            <v-select v-model="form.sex" :items="['Male', 'Female']" label="Sex *" variant="outlined" placeholder="Select Sex" :error-messages="vHead$.sex.$errors.map(e => e.$message)" @blur="vHead$.sex.$touch()"></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Date of Birth *</label>
            <v-text-field v-model="form.date_of_birth" label="Date of Birth *" type="date" variant="outlined" :error-messages="vHead$.date_of_birth.$errors.map(e => e.$message)" @blur="vHead$.date_of_birth.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
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
           <!-- NEW FIELD: Unit/Room/Apartment number -->
          <v-col cols="12" md="4">
            <label class="v-label">Unit/Room/Apartment Number</label>
            <v-text-field v-model="form.address_unit_room_apt_number" label="Unit/Room/Apartment Number" variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">House Number/Lot/Block *</label>
            <v-text-field v-model="form.address_house_number" label="House Number/Lot/Block *" variant="outlined" :error-messages="vHead$.address_house_number.$errors.map(e => e.$message)" @blur="vHead$.address_house_number.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label">Street *</label>
            <v-text-field v-model="form.address_street" label="Street *" variant="outlined" :error-messages="vHead$.address_street.$errors.map(e => e.$message)" @blur="vHead$.address_street.$touch()"></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Subdivision/Zone/Sitio/Purok *</label>
            <v-text-field v-model="form.address_subdivision_zone" label="Subdivision/Zone/Sitio/Purok *" variant="outlined" :error-messages="vHead$.address_subdivision_zone.$errors.map(e => e.$message)" @blur="vHead$.address_subdivision_zone.$touch()"></v-text-field>
          </v-col>
          <!-- NEW FIELD: Type of Household -->
          <v-col cols="12" md="6">
            <label class="v-label">Type of Household</label>
            <v-select 
              v-model="form.type_of_household" 
              :items="['Owner', 'Tenant/Border', 'Sharer']" 
              label="Type of Household *" 
              variant="outlined" 
              placeholder="Select Type"
              :error-messages="vHead$.type_of_household.$errors.map(e => e.$message)" 
              @blur="vHead$.type_of_household.$touch()">
            </v-select>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">City/Municipality</label>
            <v-text-field v-model="form.address_city_municipality" label="City/Municipality" variant="outlined" readonly></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label">Years at Current Address *</label>
            <v-text-field v-model="form.years_at_current_address" label="Years at Current Address *" type="number" variant="outlined" :error-messages="vHead$.years_at_current_address.$errors.map(e => e.$message)" @blur="vHead$.years_at_current_address.$touch()"></v-text-field>
          </v-col>

          <!-- UPDATED: Proof of Residency for multiple attachments -->
          <v-col cols="12" md="6">
            <label class="v-label">Upload Proof of Residency *</label>
            <v-file-input 
              v-model="newProofResidencyFiles" 
              label="Upload Proof of Residency *" 
              variant="outlined" 
              accept="image/*,application/pdf" 
              :error-messages="vHead$.proof_of_residency_file.$errors.map(e => e.$message)" 
              show-size 
              clearable 
              multiple 
              @blur="vHead$.proof_of_residency_file.$touch()">
            </v-file-input>
            <div class="d-flex flex-wrap gap-2 mt-2">
              <div v-for="(item, index) in proofResidencyPreviews" :key="item.id" class="position-relative">
                <template v-if="item.file && item.file.type.startsWith('image/')">
                  <!-- BUG FIX: Changed max-height/width to explicit height/width for reliable rendering -->
                  <v-img :src="item.url" class="border rounded" height="100" width="100" contain></v-img>
                </template>
                <template v-else-if="item.file && item.file.type === 'application/pdf'">
                  <v-icon size="64" class="border rounded" style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
                    mdi-file-pdf-box
                  </v-icon>
                  <p class="text-caption text-truncate mt-1" style="max-width: 100px;">{{ item.file.name }}</p>
                </template>
                <v-btn icon="mdi-close-circle" size="x-small" color="error" class="position-absolute" style="top: -8px; right: -8px;" @click="removeProofOfResidencyImage(index)"></v-btn>
              </div>
            </div>
          </v-col>

          <!-- NEW: Authorization Letter Field for Head -->
          <v-col cols="12" md="6">
            <label class="v-label">Authorization Letter (Optional)</label>
            <v-file-input 
              v-model="form.authorization_letter_file" 
              label="Upload Authorization Letter" 
              variant="outlined" 
              accept="image/*,application/pdf" 
              show-size 
              clearable 
              @blur="vHead$.authorization_letter_file.$touch()">
            </v-file-input>
            <!-- Authorization Letter already uses explicit height="150", which is good. -->
            <v-img v-if="authorizationLetterPreviewUrl" :src="authorizationLetterPreviewUrl" class="mt-2" height="150" contain></v-img>
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
            <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
            <v-img v-if="voterIdPreviewUrl" :src="voterIdPreviewUrl" class="mt-2" height="150" contain></v-img>
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
            <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
            <v-img v-if="pwdCardPreviewUrl" :src="pwdCardPreviewUrl" class="mt-2" height="150" contain></v-img>
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
              <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
              <v-img v-if="seniorCardPreviewUrl" :src="seniorCardPreviewUrl" class="mt-2" height="150" contain></v-img>
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
              <v-text-field 
                v-model="form.password" 
                label="Password *" 
                :type="showHeadPassword ? 'text' : 'password'" 
                variant="outlined" 
                hint="Minimum 8 characters, with lowercase, uppercase, numbers, and special characters. At least 3 types required." 
                persistent-hint 
                :error-messages="vHead$.password.$errors.map(e => e.$message)" 
                @blur="vHead$.password.$touch()" 
                :append-inner-icon="showHeadPassword ? 'mdi-eye-off' : 'mdi-eye'" 
                @click:append-inner="showHeadPassword = !showHeadPassword">
              </v-text-field>

              <!-- Password Validation Checklist UI -->
              <v-card class="mt-2" flat border>
                <v-card-text class="py-2">
                  <p class="text-subtitle-2 mb-2">Your password must contain:</p>
                  <v-list density="compact" class="py-0">
                    <v-list-item class="px-0 py-1" :class="{ 'text-success': hasEightCharacters }">
                      <template v-slot:prepend>
                        <v-icon :color="hasEightCharacters ? 'success' : 'grey'" :icon="hasEightCharacters ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>At least 8 characters</v-list-item-title>
                    </v-list-item>
                    <v-list-item class="px-0 py-1">
                      <template v-slot:prepend>
                        <v-icon :color="atLeastThreeTypesValid ? 'success' : 'grey'" :icon="atLeastThreeTypesValid ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>At least 3 of the following:</v-list-item-title>
                    </v-list-item>
                    <v-list-item class="px-4 py-0" :class="{ 'text-success': hasLowercase }">
                      <template v-slot:prepend>
                        <v-icon :color="hasLowercase ? 'success' : 'grey'" :icon="hasLowercase ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>Lower case letters (a-z)</v-list-item-title>
                    </v-list-item>
                    <v-list-item class="px-4 py-0" :class="{ 'text-success': hasUppercase }">
                      <template v-slot:prepend>
                        <v-icon :color="hasUppercase ? 'success' : 'grey'" :icon="hasUppercase ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>Upper case letters (A-Z)</v-list-item-title>
                    </v-list-item>
                    <v-list-item class="px-4 py-0" :class="{ 'text-success': hasNumber }">
                      <template v-slot:prepend>
                        <v-icon :color="hasNumber ? 'success' : 'grey'" :icon="hasNumber ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>Numbers (0-9)</v-list-item-title>
                    </v-list-item>
                    <v-list-item class="px-4 py-0" :class="{ 'text-success': hasSpecial }">
                      <template v-slot:prepend>
                        <v-icon :color="hasSpecial ? 'success' : 'grey'" :icon="hasSpecial ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                      </template>
                      <v-list-item-title>Special characters (e.g. !@#$%^&*)</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
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
              <!-- UPDATED: Display middle name and suffix for members -->
              <td>{{ member.first_name }} {{ member.middle_name ? member.middle_name + ' ' : '' }}{{ member.last_name }}{{ member.suffix ? ' ' + member.suffix : '' }}</td>
              <td>{{ member.relationship_to_head === 'Other' ? member.other_relationship : member.relationship_to_head }}</td>
              <td>{{ calculateAge(member.date_of_birth) }}</td>
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
            <v-col cols="12" md="3">
              <label class="v-label">Last Name *</label>
              <v-text-field v-model="memberForm.last_name" label="Last Name *" variant="outlined" :error-messages="vMember$.last_name.$errors.map(e => e.$message)" @blur="vMember$.last_name.$touch()"></v-text-field>
            </v-col>
            <!-- New Suffix Field for Member -->
            <v-col cols="12" md="1">
              <label class="v-label">Suffix</label>
              <v-select v-model="memberForm.suffix" :items="suffixOptions" label="Suffix" variant="outlined" clearable></v-select>
            </v-col>
            <!-- End New Suffix Field -->
            
            <v-col cols="12" md="6">
              <label class="v-label">Relationship to Head *</label>
              <v-select v-model="memberForm.relationship_to_head" :items="relationshipOptions" label="Relationship to Head *" variant="outlined" :error-messages="vMember$.relationship_to_head.$errors.map(e => e.$message)" @blur="vMember$.relationship_to_head.$touch()"></v-select>
            </v-col>
            <v-col cols="12" md="6" v-if="memberForm.relationship_to_head === 'Other'">
                <label class="v-label">Please Specify Relationship *</label>
                <v-text-field v-model="memberForm.other_relationship" label="Please Specify Relationship *" variant="outlined" :error-messages="vMember$.other_relationship.$errors.map(e => e.$message)" @blur="vMember$.other_relationship.$touch()"></v-text-field>
            </v-col>

            <v-col cols="12" md="6">
              <label class="v-label">Upload Proof of Relationship</label>
              <v-file-input v-model="memberForm.proof_of_relationship_file" label="Upload Proof of Relationship" variant="outlined" accept="image/*,.pdf" hint="Required for relationship validation'." persistent-hint :error-messages="vMember$.proof_of_relationship_file.$errors.map(e => e.$message)" show-size clearable @blur="vMember$.proof_of_relationship_file.$touch()"></v-file-input>
              <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
              <v-img v-if="memberRelationshipProofPreviewUrl" :src="memberRelationshipProofPreviewUrl" class="mt-2" height="150" contain></v-img>
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
              <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
              <v-img v-if="memberVoterIdPreviewUrl" :src="memberVoterIdPreviewUrl" class="mt-2" height="150" contain></v-img>
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
            <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
              <v-img v-if="memberPwdCardPreviewUrl" :src="memberPwdCardPreviewUrl" class="mt-2" height="150" contain></v-img>
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
                <!-- BUG FIX: Changed max-height to explicit height for reliable rendering -->
                <v-img v-if="memberSeniorCardPreviewUrl" :src="memberSeniorCardPreviewUrl" class="mt-2" height="150" contain></v-img>
            </v-col>
            </template>
          </v-row>
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
import { reactive, ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'; // Import onBeforeUnmount
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers, numeric, alphaNum } from '@vuelidate/validators'; // Added alphaNum
import { useMyFetch } from '~/composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const saving = ref(false);
const showHeadPassword = ref(false);
const showHeadConfirmPassword = ref(false);
const showMemberPassword = ref(false);

const suffixOptions = ['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI']; // Define suffix options

const form = reactive({
  first_name: '', middle_name: '', last_name: '', suffix: null, // Added suffix
  sex: null, date_of_birth: '',
  civil_status: null, citizenship: 'Filipino', occupation_status: null, email: '', contact_number: '',
  password: '', confirmPassword: '',
  address_house_number: '', 
  address_unit_room_apt_number: '', // NEW: Unit/Room/Apartment number
  address_street: '', address_subdivision_zone: '', address_city_municipality: 'Manila City',
  type_of_household: null, // NEW: Type of Household
  years_at_current_address: null, 
  proof_of_residency_file: [], // Changed to array for multiple File objects
  authorization_letter_file: null, // NEW: Authorization Letter file object
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
  household_members_to_create: [],
});

// NEW: Temporary ref for new file selection in proof of residency
const newProofResidencyFiles = ref([]); 

// Refs to store generated object URLs for single file previews
const voterIdPreviewUrl = ref(null);
const pwdCardPreviewUrl = ref(null);
const seniorCardPreviewUrl = ref(null);
const authorizationLetterPreviewUrl = ref(null); 

// Ref to store { file: File, url: string, id: number } for multiple proof of residency previews
// We use 'id' for stable keys in v-for and easier revocation
const proofResidencyPreviews = ref([]); 
let proofResidencyIdCounter = 0; // To generate unique IDs for previews

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

const dateOfBirthValidation = {
  required,
  minValue: helpers.withMessage('Date of birth cannot be more than 100 years ago.', (value) => {
    if (!value) return true;
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
    return new Date(value) >= hundredYearsAgo;
  }),
  maxValue: helpers.withMessage('Date of birth cannot be in the future.', (value) => {
    if (!value) return true;
    return new Date(value) <= new Date();
  })
};

// Computed properties for real-time password validation UI
const hasEightCharacters = computed(() => form.password.length >= 8);
const hasLowercase = computed(() => /(?=.*[a-z])/.test(form.password));
const hasUppercase = computed(() => /(?=.*[A-Z])/.test(form.password));
const hasNumber = computed(() => /(?=.*\d)/.test(form.password));
const hasSpecial = computed(() => /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(form.password));

const atLeastThreeTypesValid = computed(() => {
  let count = 0;
  if (hasLowercase.value) count++;
  if (hasUppercase.value) count++;
  if (hasNumber.value) count++;
  if (hasSpecial.value) count++;
  return count >= 3;
});


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
suffix: {}, // Suffix is optional, so no validation rule needed by default
  sex: { required }, date_of_birth: dateOfBirthValidation,
  civil_status: { required }, citizenship: { required }, occupation_status: { required },
  email: { required, email }, contact_number: { required },
  password: { 
    required, 
    minLength: helpers.withMessage('Must be at least 8 characters long.', minLength(8)),
    hasLowercase: helpers.withMessage('Must contain at least one lowercase letter.', helpers.regex(/(?=.*[a-z])/)), // NEW
    hasUppercase: helpers.withMessage('Must contain at least one uppercase letter.', helpers.regex(/(?=.*[A-Z])/)),
    hasNumber: helpers.withMessage('Must contain at least one number (0-9).', helpers.regex(/(?=.*\d)/)), // NEW
    hasSpecial: helpers.withMessage('Must contain at least one special character (e.g., !@#$%^&*).', helpers.regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)),
    atLeastThreeTypes: helpers.withMessage('Must contain at least 3 of the 4 types (lowercase, uppercase, numbers, special characters).', (value) => {
        let count = 0;
        if (/(?=.*[a-z])/.test(value)) count++;
        if (/(?=.*[A-Z])/.test(value)) count++;
        if (/(?=.*\d)/.test(value)) count++;
        if (/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) count++;
        return count >= 3;
    })
  },
  confirmPassword: { required, sameAs: helpers.withMessage('Passwords do not match.', sameAs(computed(() => form.password))) },
  address_house_number: { required, numeric }, 
  address_unit_room_apt_number: { }, // NEW: Unit/Room/Apartment number (optional for now)
  address_street: { required }, 
  address_subdivision_zone: { required },
  type_of_household: { required: helpers.withMessage('Type of Household is required.', required) }, // NEW: Type of Household (required)
  years_at_current_address: { required, numeric }, 
  proof_of_residency_file: { 
    required: helpers.withMessage('At least one Proof of Residency is required.', (value) => value && value.length > 0) 
  }, // Updated validation for array of File objects
  authorization_letter_file: {}, // NEW: Optional file
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => form.is_voter && !form.voter_id_file)) },
  voter_id_file: { requiredIf: helpers.withMessage("Voter's ID Card or Number is required.", requiredIf(() => form.is_voter && !form.voter_id_number)) },
  pwd_id: { requiredIf: helpers.withMessage('PWD ID Number or Card is required.', requiredIf(() => form.is_pwd && !form.pwd_card_file)) },
  pwd_card_file: { requiredIf: helpers.withMessage('PWD Card or ID Number is required.', requiredIf(() => form.is_pwd && !form.pwd_id)) },
  senior_citizen_id: { requiredIf: helpers.withMessage('Senior Citizen ID Number or Card is required.', requiredIf(() => form.is_senior_citizen && !form.senior_citizen_card_file)) },
  senior_citizen_card_file: { requiredIf: helpers.withMessage('Senior Citizen Card or ID Number is required.', requiredIf(() => form.is_senior_citizen && !form.senior_citizen_id)) },
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
  first_name: '', middle_name: '', last_name: '', suffix: null, // Added suffix
  relationship_to_head: null, other_relationship: '',
  sex: null, date_of_birth: '', civil_status: null, citizenship: 'Filipino',
  occupation_status: null, contact_number: '', email: '', password: '',
  is_voter: false, voter_id_number: '', voter_id_file: null,
  is_pwd: false, pwd_id: '', pwd_card_file: null,
  is_senior_citizen: false, senior_citizen_id: '', senior_citizen_card_file: null,
  proof_of_relationship_file: null
});

const memberForm = reactive(getInitialMemberForm());

const memberVoterIdPreviewUrl = ref(null);
const memberPwdCardPreviewUrl = ref(null);
const memberSeniorCardPreviewUrl = ref(null);
const memberRelationshipProofPreviewUrl = ref(null);

const memberAge = computed(() => calculateAge(memberForm.date_of_birth));
const isMemberSenior = computed(() => memberAge.value !== null && memberAge.value >= 60);

const memberRules = {
  first_name: { required }, last_name: { required },
  suffix: {}, // Suffix is optional for members too
  relationship_to_head: { required },
  other_relationship: { requiredIf: helpers.withMessage('Please specify the relationship.', requiredIf(() => memberForm.relationship_to_head === 'Other')) },
  sex: { required }, date_of_birth: dateOfBirthValidation, civil_status: { required },
  citizenship: { required }, occupation_status: { required },
  email: { requiredIf: requiredIf(() => !!memberForm.password), email },
  password: { requiredIf: requiredIf(() => !!memberForm.email), minLength: minLength(6) },
  proof_of_relationship_file: { required: helpers.withMessage('Proof of Relationship is required.', required) },
  voter_id_number: { requiredIf: helpers.withMessage("Voter's ID Number or Card is required.", requiredIf(() => memberForm.is_voter && !memberForm.voter_id_file)) },
  voter_id_file: { requiredIf: helpers.withMessage("Voter's ID Card or Number is required.", requiredIf(() => memberForm.is_voter && !memberForm.voter_id_number)) },
  pwd_id: { requiredIf: helpers.withMessage('PWD ID Number or Card is required.', requiredIf(() => memberForm.is_pwd && !memberForm.pwd_card_file)) },
  pwd_card_file: { requiredIf: helpers.withMessage('PWD Card or ID Number is required.', requiredIf(() => memberForm.is_pwd && !memberForm.pwd_id)) },
  senior_citizen_id: { requiredIf: helpers.withMessage('Senior Citizen ID Number or Card is required.', requiredIf(() => memberForm.is_senior_citizen && !memberForm.senior_citizen_card_file)) },
  senior_citizen_card_file: { requiredIf: helpers.withMessage('Senior Citizen Card or ID Number is required.', requiredIf(() => memberForm.is_senior_citizen && !memberForm.senior_citizen_id)) },
};
const vMember$ = useVuelidate(memberRules, memberForm);

// Helper function to create/revoke object URLs
const urlCreator = (file) => file ? URL.createObjectURL(file) : null;
const urlRevoker = (url) => { if (url) URL.revokeObjectURL(url); };

// Watch for changes in the temporary input for Proof of Residency
// This watches the v-file-input's model-value (new files selected)
watch(newProofResidencyFiles, (newFiles) => {
  if (newFiles && newFiles.length > 0) {
    // Add new files to the main form array
    form.proof_of_residency_file.push(...newFiles);
    // Clear the temporary input so the v-file-input itself visually resets
    newProofResidencyFiles.value = [];
    vHead$.value.proof_of_residency_file.$touch(); // Re-trigger validation for the main array
  }
});

// Watch the actual form.proof_of_residency_file array for changes
// This is where we manage the creation and revocation of object URLs for previews
watch(() => form.proof_of_residency_file, (currentFiles, oldFiles) => {
  // Revoke URLs for files that are no longer in the list
  if (oldFiles) {
    const oldFileUrls = new Map(oldFiles.map((f, i) => [f, proofResidencyPreviews.value[i]?.url]));
    const currentFileSet = new Set(currentFiles);
    proofResidencyPreviews.value.forEach(item => {
      if (!currentFileSet.has(item.file)) {
        urlRevoker(item.url);
      }
    });
  }

  // Generate new previews for current files, re-using existing ones if possible
  const newPreviews = [];
  currentFiles.forEach(file => {
    // Find if this file already has a preview
    const existingPreview = proofResidencyPreviews.value.find(p => p.file === file);
    if (existingPreview) {
      newPreviews.push(existingPreview);
    } else {
      // Create new preview
      newPreviews.push({
        file: file,
        url: urlCreator(file),
        id: proofResidencyIdCounter++ // Assign a unique ID
      });
    }
  });
  proofResidencyPreviews.value = newPreviews;
}, { deep: true, immediate: true }); // Deep watch for array content, immediate for initial load

// Watchers for single file previews (ensure old URLs are revoked)
watch(() => form.voter_id_file, (newFile, oldFile) => { 
  urlRevoker(voterIdPreviewUrl.value); 
  voterIdPreviewUrl.value = urlCreator(newFile); 
});
watch(() => form.pwd_card_file, (newFile, oldFile) => { 
  urlRevoker(pwdCardPreviewUrl.value); 
  pwdCardPreviewUrl.value = urlCreator(newFile); 
});
watch(() => form.senior_citizen_card_file, (newFile, oldFile) => { 
  urlRevoker(seniorCardPreviewUrl.value); 
  seniorCardPreviewUrl.value = urlCreator(newFile); 
});
watch(() => form.authorization_letter_file, (newFile, oldFile) => { 
  urlRevoker(authorizationLetterPreviewUrl.value); 
  authorizationLetterPreviewUrl.value = urlCreator(newFile); 
}); 

watch(() => memberForm.voter_id_file, (newFile, oldFile) => { 
  urlRevoker(memberVoterIdPreviewUrl.value);
  memberVoterIdPreviewUrl.value = urlCreator(newFile); 
});
watch(() => memberForm.pwd_card_file, (newFile, oldFile) => { 
  urlRevoker(memberPwdCardPreviewUrl.value);
  memberPwdCardPreviewUrl.value = urlCreator(newFile); 
});
watch(() => memberForm.senior_citizen_card_file, (newFile, oldFile) => { 
  urlRevoker(memberSeniorCardPreviewUrl.value);
  memberSeniorCardPreviewUrl.value = urlCreator(newFile); 
});
watch(() => memberForm.proof_of_relationship_file, (newFile, oldFile) => { 
  urlRevoker(memberRelationshipProofPreviewUrl.value);
  memberRelationshipProofPreviewUrl.value = urlCreator(newFile); 
});


const removeProofOfResidencyImage = (indexToRemove) => {
  // Revoke the specific URL for the item being removed
  urlRevoker(proofResidencyPreviews.value[indexToRemove]?.url);
  // Remove from both form data and preview data
  form.proof_of_residency_file.splice(indexToRemove, 1);
  proofResidencyPreviews.value.splice(indexToRemove, 1); // Keep previews in sync
  vHead$.value.proof_of_residency_file.$touch(); // Re-trigger validation
};

const openMemberDialog = (index = null) => { 
  if (index !== null) {
    editingMemberIndex.value = index;
    Object.assign(memberForm, form.household_members_to_create[index]);
    // Set previews for existing member files if they exist
    memberVoterIdPreviewUrl.value = urlCreator(memberForm.voter_id_file);
    memberPwdCardPreviewUrl.value = urlCreator(memberForm.pwd_card_file);
    memberSeniorCardPreviewUrl.value = urlCreator(memberForm.senior_citizen_card_file);
    memberRelationshipProofPreviewUrl.value = urlCreator(memberForm.proof_of_relationship_file);
  } else {
    editingMemberIndex.value = null;
    Object.assign(memberForm, getInitialMemberForm()); // Reset form for new member
    urlRevoker(memberVoterIdPreviewUrl.value); memberVoterIdPreviewUrl.value = null;
    urlRevoker(memberPwdCardPreviewUrl.value); memberPwdCardPreviewUrl.value = null;
    urlRevoker(memberSeniorCardPreviewUrl.value); memberSeniorCardPreviewUrl.value = null;
    urlRevoker(memberRelationshipProofPreviewUrl.value); memberRelationshipProofPreviewUrl.value = null;
  }
  showMemberDialog.value = true;
};

const closeMemberDialog = () => {
    showMemberDialog.value = false;
    editingMemberIndex.value = null;
    vMember$.value.$reset();
    // Revoke object URLs for memberForm files before resetting
    urlRevoker(memberVoterIdPreviewUrl.value);
    urlRevoker(memberPwdCardPreviewUrl.value);
    urlRevoker(memberSeniorCardPreviewUrl.value);
    urlRevoker(memberRelationshipProofPreviewUrl.value);

    Object.assign(memberForm, getInitialMemberForm());
    memberVoterIdPreviewUrl.value = null;
    memberPwdCardPreviewUrl.value = null;
    memberSeniorCardPreviewUrl.value = null;
    memberRelationshipProofPreviewUrl.value = null;
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

const removeMember = (index) => { 
  // For robustness, revoke URLs associated with the member's files if they exist
  const memberToRemove = form.household_members_to_create[index];
  urlRevoker(urlCreator(memberToRemove.voter_id_file));
  urlRevoker(urlCreator(memberToRemove.pwd_card_file));
  urlRevoker(urlCreator(memberToRemove.senior_citizen_card_file));
  urlRevoker(urlCreator(memberToRemove.proof_of_relationship_file));

  form.household_members_to_create.splice(index, 1); 
};


const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) { // Handle null or undefined file
      resolve(null);
      return;
    }

    // If it's already a base64 string (e.g., from an existing record), resolve it as is.
    if (typeof file === 'string' && file.startsWith('data:')) {
      resolve(file);
      return;
    }

    // Ensure it's a File object or something that FileReader can handle
    if (!(file instanceof File || file instanceof Blob)) {
        console.warn('Attempted to convert non-File/Blob object to base64:', file);
        resolve(null);
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
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
    const payload = { ...form }; // 'form' already includes 'suffix', address_unit_room_apt_number, type_of_household
    
    // Assign calculated and head-specific properties
    payload.age = headCalculatedAge.value; // Send age for head, backend also calculates it
    payload.is_household_head = true;
    payload.status = 'Pending'; // New registrations are pending for approval
    // payload.date_approved is set on approval, not here

    // Convert all files for the HEAD to base64
    const [
      voter_registration_proof_base64,
      pwd_card_base64,
      senior_citizen_card_base64,
      proof_of_residency_base64_array, // This will be an array of base64 strings
      authorization_letter_base64 // NEW: Authorization Letter base64
    ] = await Promise.all([
      convertFileToBase64(form.voter_id_file),
      convertFileToBase64(form.pwd_card_file),
      convertFileToBase64(form.senior_citizen_card_file),
      // Map and convert each proof of residency file to base64
      Promise.all(form.proof_of_residency_file.map(file => convertFileToBase64(file))),
      convertFileToBase64(form.authorization_letter_file) // NEW
    ]);

    payload.voter_registration_proof_base64 = voter_registration_proof_base64;
    payload.pwd_card_base64 = pwd_card_base64;
    payload.senior_citizen_card_base64 = senior_citizen_card_base64;
    payload.proof_of_residency_base64 = proof_of_residency_base64_array.filter(Boolean); // Filter out any nulls
    payload.authorization_letter_base64 = authorization_letter_base64; // NEW
    
    // Process all members: convert their files and prepare them for the payload
    payload.household_members_to_create = await Promise.all(
      form.household_members_to_create.map(async (member) => {
        const newMemberPayload = { ...member }; // 'member' object already includes 'suffix'
        
        newMemberPayload.status = 'Pending'; // New member registrations are also pending
        // newMemberPayload.date_approved is set on approval

        const [
            member_voter_registration_proof_base64,
            member_pwd_card_base64,
            member_senior_citizen_card_base64,
            member_proof_of_relationship_base64
        ] = await Promise.all([
            convertFileToBase64(member.voter_id_file),
            convertFileToBase64(member.pwd_card_file),
            convertFileToBase64(member.senior_citizen_card_file),
            convertFileToBase64(member.proof_of_relationship_file)
        ]);

        newMemberPayload.voter_registration_proof_base64 = member_voter_registration_proof_base64;
        newMemberPayload.pwd_card_base64 = member_pwd_card_base64;
        newMemberPayload.senior_citizen_card_base64 = member_senior_citizen_card_base64;
        newMemberPayload.proof_of_relationship_base64 = member_proof_of_relationship_base64;

        // Clean up original file properties from the payload
        delete newMemberPayload.voter_id_file;
        delete newMemberPayload.pwd_card_file;
        delete newMemberPayload.senior_citizen_card_file;
        delete newMemberPayload.proof_of_relationship_file;
        
        return newMemberPayload;
      })
    );
    
    // Clean up original file properties and confirmPassword from the top-level payload
    delete payload.voter_id_file;
    delete payload.pwd_card_file;
    delete payload.senior_citizen_card_file;
    delete payload.proof_of_residency_file; // Remove the array of File objects
    delete payload.authorization_letter_file; // NEW
    delete payload.confirmPassword; // confirmPassword is only for frontend validation
    
    const { data, error } = await useMyFetch("/api/admin/residents", { method: 'post', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Error registering household.');
    
    $toast.fire({ title: 'Household registered successfully! It is now approved.', icon: 'success' });
    
    router.push('/residents-account-management');

  } catch (err) {
    console.error("Registration error:", err);
    $toast.fire({ title: err.message || 'An unexpected error occurred.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}

// Ensure all object URLs are revoked when the component is unmounted to prevent memory leaks
onBeforeUnmount(() => {
  urlRevoker(voterIdPreviewUrl.value);
  urlRevoker(pwdCardPreviewUrl.value);
  urlRevoker(seniorCardPreviewUrl.value);
  urlRevoker(authorizationLetterPreviewUrl.value);

  proofResidencyPreviews.value.forEach(item => urlRevoker(item.url));

  urlRevoker(memberVoterIdPreviewUrl.value);
  urlRevoker(memberPwdCardPreviewUrl.value);
  urlRevoker(memberSeniorCardPreviewUrl.value);
  urlRevoker(memberRelationshipProofPreviewUrl.value);

  // Note: For household members that might still be in the `form.household_members_to_create`
  // when the component unmounts, their file URLs would also need explicit revocation
  // if they were not already handled (e.g., if a member dialog was closed).
  // This is a more complex cleanup scenario, but important for long-lived components.
});

</script>

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
.gap-2 { gap: 8px; } /* Added utility class for spacing */
.position-relative { position: relative; }
.position-absolute { position: absolute; }
.v-list-item-title {
  font-size: 0.875rem !important; /* Adjust font size to fit */
  line-height: 1.2; /* Adjust line height for better spacing */
}
</style>