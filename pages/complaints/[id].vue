<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Complaint...</p>
    </div>
    <div v-else-if="!form.complainant_resident_id">
      <v-alert type="warning" prominent border="start" text="Complaint not found or could not be loaded.">
        <template v-slot:append><v-btn to="/complaints">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Complaint Details</h2>
          <p class="text-grey-darken-1">Reference #: {{ form.ref_no }}</p>
        </v-col>
        <v-col class="text-right">
          <!-- Status chip now moved up for consistency -->
          <v-chip :color="getStatusColor(form.status)" label size="large" class="font-weight-bold mr-4">{{ form.status }}</v-chip>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving" :disabled="isComplainantDeactivated">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2" :disabled="isComplainantDeactivated">Cancel</v-btn>
          <v-btn color="info" @click="openPrintDialog" prepend-icon="mdi-printer" variant="tonal" class="mr-2">Print</v-btn> <!-- NEW PRINT BUTTON -->
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <!-- ✨ STATUS TRACKER START ✨ -->
      <div class="status-tracker-container my-12">
        <div class="progress-bar-container">
            <div class="progress-bar-bg"></div>
            <div
                class="progress-bar-fg"
                :class="isFailureState ? 'bg-error' : 'bg-primary'"
                :style="{ width: progressWidth }"
            ></div>
        </div>
        <div class="steps-container">
            <div v-for="(step, index) in trackerSteps" :key="step.name" class="step-item">
                <div
                    class="step-circle"
                    :class="{
                        'completed': !isFailureState && index < activeStepIndex,
                        'current': !isFailureState && index === activeStepIndex,
                        'declined': isFailureState && index < activeStepIndex,
                        'failure-point': isFailureState && index === activeStepIndex
                    }"
                >
                    <v-icon size="large">
                        {{ getStepIcon(index, step.icon) }}
                    </v-icon>
                </div>
                <div
                    class="step-label mt-3"
                    :class="{ 'font-weight-bold text-primary': !isFailureState && index === activeStepIndex }"
                >
                    {{ step.name }}
                </div>
            </div>
        </div>
      </div>
      <!-- ✨ STATUS TRACKER END ✨ -->

      <!-- UPDATED ALERT LOGIC: Prioritize displaying reason if complainant deactivated and reason exists -->
      <v-alert
          v-if="isComplainantDeactivated && form.status_reason"
          type="error"
          variant="tonal"
          border="start"
          icon="mdi-information-outline"
          density="compact"
          class="mb-6"
      >
          <template v-slot:title><strong class="text-error">Complainant Account Deactivated</strong></template>
            {{ form.status_reason }}
          <span>Contact the admin to review and update your status.</span>
      </v-alert>
      <v-alert
          v-else-if="isComplainantDeactivated && !form.status_reason"
          type="warning"
          prominent
          border="start"
          icon="mdi-account-cancel"
          class="mb-6"
      >
          <template v-slot:title>Complainant Account Deactivated</template>
          The complainant's account is currently deactivated. This complaint cannot be modified or progressed until the account is reactivated.
          The status has been automatically changed to 'Dismissed' / 'Declined'.
      </v-alert>


      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
            <!-- Complainant Details -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Complainant Name <span v-if="editMode" class="text-red">*</span></label>
                <v-autocomplete
                  v-if="editMode"
                  v-model="form.complainant_resident_id"
                  v-model:search="complainantSearchQuery"
                  label="Search Complainant..." variant="outlined" :items="complainantSearchResults" item-title="name" item-value="_id"
                  :loading="isLoadingComplainants" :error-messages="v$.complainant_resident_id.$errors.map(e => e.$message)"
                  @blur="v$.complainant_resident_id.$touch" @update:model-value="onComplainantSelect" no-filter
                  :disabled="isComplainantDeactivated"
                >
                    <template v-slot:item="{ props, item }"><v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item></template>
                </v-autocomplete>
                <v-text-field v-else :model-value="form.complainant_display_name" variant="outlined" readonly></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Complainant Address <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.complainant_address" :readonly="!editMode || isComplainantDeactivated" variant="outlined" :error-messages="v$.complainant_address.$errors.map(e => e.$message)" @blur="v$.complainant_address.$touch"></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Contact Number <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.contact_number" type="tel" :readonly="!editMode || isComplainantDeactivated" variant="outlined" :error-messages="v$.contact_number.$errors.map(e => e.$message)" @blur="v$.contact_number.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Date of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.date_of_complaint" type="date" :readonly="!editMode || isComplainantDeactivated" variant="outlined" :error-messages="v$.date_of_complaint.$errors.map(e => e.$message)" @blur="v$.date_of_complaint.$touch"></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <label class="v-label mb-1">Time of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-text-field v-model="form.time_of_complaint" type="time" :readonly="!editMode || isComplainantDeactivated" variant="outlined" :error-messages="v$.time_of_complaint.$errors.map(e => e.$message)" @blur="v$.time_of_complaint.$touch"></v-text-field>
              </v-col>
            </v-row>
            <v-divider class="my-4"></v-divider>
            <!-- Person Complained Against & Status -->
            <v-row>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Person Complained Against <span v-if="editMode" class="text-red">*</span></label>
                <v-autocomplete
                  v-if="editMode"
                  v-model:search="personComplainedSearchQuery"
                  label="Search Resident or Enter Name..."
                  variant="outlined" :items="personComplainedSearchResults" item-title="name" item-value="_id"
                  :loading="isLoadingPersonComplained" :error-messages="v$.person_complained_against_name.$errors.map(e => e.$message)"
                  @blur="v$.person_complained_against_name.$touch" @update:model-value="onPersonComplainedSelect" no-filter
                  :disabled="isComplainantDeactivated"
                >
                    <template v-slot:item="{ props, item }"><v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.email"></v-list-item></template>
                    <template v-slot:no-data><v-list-item><v-list-item-title>No resident found. Name will be saved as entered.</v-list-item-title></v-list-item></template>
                </v-autocomplete>
                <v-text-field v-else :model-value="form.person_complained_against_name" variant="outlined" readonly></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <label class="v-label mb-1">Status</label>
                <!-- This text field is now less critical for status display as the chip and tracker do it -->
                <v-text-field :model-value="form.status" variant="outlined" readonly messages="The status is managed via actions on this page.">
                  <template v-slot:prepend-inner><v-chip :color="getStatusColor(form.status)" label size="small" :prepend-icon="getStatusIcon(form.status)">{{ form.status }}</v-chip></template>
                </v-text-field>
              </v-col>
            </v-row>
            <!-- Description -->
            <v-row>
              <v-col cols="12">
                <label class="v-label mb-1">Category <span v-if="editMode" class="text-red">*</span></label>
                <v-select :readonly="!editMode || isComplainantDeactivated" v-model="form.category" :items="complaintCategories" variant="outlined" :error-messages="v$.category.$errors.map(e => e.$message)" @blur="v$.category.$touch"></v-select>
              </v-col>
              <v-col cols="12">
                <label class="v-label mb-1">Description of Complaint <span v-if="editMode" class="text-red">*</span></label>
                <v-textarea v-model="form.notes_description" :readonly="!editMode || isComplainantDeactivated" variant="outlined" rows="5" auto-grow :error-messages="v$.notes_description.$errors.map(e => e.$message)" @blur="v$.notes_description.$touch"></v-textarea>
              </v-col>
            </v-row>
        </v-card-text>
      </v-card>

      <!-- Proof of Complaint Section -->
      <v-card class="mt-4" flat border>
        <v-card-title>Proof of Complaint</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
          <div v-if="form.proofs_display && form.proofs_display.length > 0">
            <v-row>
              <v-col
                v-for="(proofItem, index) in form.proofs_display"
                :key="index"
                cols="6" sm="4" md="3"
              >
                <v-card flat outlined class="d-flex flex-column justify-center align-center">
                    <div class="image-video-preview-wrapper cursor-pointer" @click="openProofDialog(proofItem)">
                        <template v-if="proofItem.type.startsWith('image/')">
                            <v-img
                                :src="proofItem.url"
                                aspect-ratio="1"
                                cover
                            >
                                <template v-slot:placeholder>
                                    <v-row class="fill-height ma-0" align="center" justify="center">
                                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                                    </v-row>
                                </template>
                                <template v-slot:error>
                                    <v-row class="fill-height ma-0" align="center" justify="center">
                                        <v-icon size="64" color="error">mdi-image-broken-variant</v-icon>
                                    </v-row>
                                </template>
                            </v-img>
                        </template>
                        <template v-else-if="proofItem.type.startsWith('video/')">
                            <video
                                :src="proofItem.url"
                                preload="metadata"
                                muted
                                playsinline
                                @error="handleMediaDisplayError(proofItem.url, 'video')"
                                style="width: 100%; height: 100%; object-fit: contain; background-color: black;"
                            >
                                Your browser does not support the video tag.
                            </video>
                            <v-icon size="48" color="white" class="video-play-icon">mdi-play-circle-outline</v-icon>
                        </template>
                        <template v-else>
                            <div class="pa-4 text-center">
                                <v-icon size="64">mdi-file</v-icon>
                                <p class="text-caption mt-2">Unsupported file type</p>
                            </div>
                        </template>
                    </div>
                </v-card>
              </v-col>
            </v-row>
          </div>
          <v-alert v-else type="info" variant="tonal">
            No proof was attached to this complaint.
          </v-alert>
        </v-card-text>
      </v-card>

      <!-- Investigation Notes Section -->
      <v-card v-if="['Under Investigation', 'Resolved', 'Dismissed', 'Unresolved'].includes(form.status)" class="mt-4" flat border>
        <v-card-title>Investigation Notes</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
          <div v-if="notesLoading" class="text-center py-4">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-2 text-grey-darken-1 text-caption">Loading Notes...</p>
          </div>
          <v-alert v-else-if="!investigationNotes.length" type="info" variant="tonal"  class="mb-4">
            No investigation notes have been added yet.
          </v-alert>
          <v-timeline v-else side="end" align="start"  class="mb-4">
            <v-timeline-item
              v-for="note in investigationNotes"
              :key="note._id"
              dot-color="blue-grey-lighten-1"
              size="small"
            >
              <template v-slot:opposite>
                <div class="text-caption text-grey-darken-1 pt-1">
                  <div>{{ formatDateTime(note.createdAt) }}</div>
                  <div class="font-weight-bold">{{ note.author?.name || 'System' }}</div>
                </div>
              </template>
              <v-alert class="pa-3" border="start"  color="blue-grey-lighten-5">
                <p class="text-body-2" style="white-space: pre-wrap;">{{ note.content }}</p>
              </v-alert>
            </v-timeline-item>
          </v-timeline>

          <v-divider class="my-4"></v-divider>
          
          <h4 class="text-subtitle-1 font-weight-medium mb-2">Add New Note</h4>
          <v-textarea
            v-model="newNoteContent"
            label="Write your note here..."
            variant="outlined"
            rows="3"
            auto-grow
            clearable
            :disabled="isComplainantDeactivated"
          ></v-textarea>
          <div class="d-flex justify-end mt-2">
            <v-btn
              color="primary"
              @click="addNote"
              :disabled="!newNoteContent || !newNoteContent.trim() || isComplainantDeactivated"
              :loading="addingNote"
              prepend-icon="mdi-plus-circle-outline"
            >
              Add Note
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
      
      <!-- Actions Card -->
      <v-card class="mt-4">
        <v-card-title>Complaint Actions</v-card-title>
        <v-divider></v-divider>
        <v-card-text>
            <div class="d-flex align-center mb-3">
              <span class="text-subtitle-1 mr-4">Current Status:</span>
              <v-chip :color="getStatusColor(form.status)" label size="large" class="font-weight-bold" :prepend-icon="getStatusIcon(form.status)">{{ form.status }}</v-chip>
            </div>
             <p class="text-caption text-grey-darken-1 mb-3">Select an action to change the complaint's status.</p>
             <v-btn v-if="form.status === 'New'" color="yellow-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Under Investigation')" prepend-icon="mdi-magnify" :disabled="isComplainantDeactivated">Start Investigation</v-btn>
             
             <!-- NEW: Mark as Unresolved button -->
             <v-btn v-if="form.status === 'Under Investigation'" color="blue-grey-darken-3" size="large" class="ma-2" @click="updateComplaintStatus('Unresolved')" prepend-icon="mdi-alert-circle-outline" :disabled="isComplainantDeactivated">Mark as Unresolved</v-btn>

             <!-- MODIFIED: Mark as Resolved available from Under Investigation or Unresolved -->
             <v-btn v-if="form.status === 'Under Investigation' || form.status === 'Unresolved'" color="green-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Resolved')" prepend-icon="mdi-check-circle" :disabled="isComplainantDeactivated">Mark as Resolved</v-btn>
             
             <!-- MODIFIED: Dismiss Complaint available from Under Investigation or Unresolved -->
             <v-btn v-if="form.status === 'Under Investigation' || form.status === 'Unresolved'" color="error" size="large" class="ma-2" @click="declineComplaintDialog = true" prepend-icon="mdi-cancel" :disabled="isComplainantDeactivated">Dismiss Complaint</v-btn>
             
             <!-- NEW: Revert to Investigation button when Unresolved -->
             <v-btn v-if="form.status === 'Unresolved'" color="yellow-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Under Investigation')" prepend-icon="mdi-magnify" :disabled="isComplainantDeactivated">Revert to Investigation</v-btn>

             <!-- MODIFIED: Close Complaint available from Resolved, New, Dismissed, or Unresolved -->
             <v-btn v-if="form.status === 'Resolved' || form.status === 'New' || form.status === 'Dismissed' || form.status === 'Unresolved'" color="grey-darken-1" size="large" class="ma-2" @click="updateComplaintStatus('Closed')" prepend-icon="mdi-archive-outline" :disabled="isComplainantDeactivated">Close Complaint</v-btn>
             
             <v-alert v-if="form.status === 'Closed'" type="info" variant="tonal" class="mt-4">
               This complaint is closed and no further actions can be taken.
             </v-alert>
             <v-alert v-if="isComplainantDeactivated && form.status !== 'Dismissed'" type="info" variant="tonal" class="mt-4">
               Actions are disabled because the complainant's account is deactivated.
             </v-alert>
        </v-card-text>
      </v-card>
    </div>
    
    <!-- Deletion Dialog -->
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>Delete this complaint record? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteComplaint" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- NEW: DIALOG FOR DISMISS COMPLAINT WITH REASON -->
    <v-dialog v-model="declineComplaintDialog" persistent max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Dismiss Complaint</v-card-title>
        <v-card-text>
          <p class="mb-4">Please provide a reason for dismissing this complaint. This reason will be recorded.</p>
          <v-textarea
            v-model="dismissReason"
            label="Reason for Dismissal"
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
          <v-btn color="grey" text @click="declineComplaintDialog = false">Cancel</v-btn>
          <v-btn color="error" :disabled="!dismissReason" :loading="isActing" @click="confirmDismiss">Confirm Dismiss</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- UPDATED: Proof Viewer Dialog (handles both images and videos) -->
    <v-dialog v-model="showProofDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-toolbar-title>Proof of Complaint</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="showProofDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text
          class="d-flex justify-center align-center"
          style="background-color: rgba(0,0,0,0.8); position: relative; width: 100vw; height: calc(100vh - 64px); /* Toolbar height */"
        >
          <template v-if="selectedProofItem.type.startsWith('image/')">
            <v-img
              :src="selectedProofItem.url"
              contain
              :style="imageStyle"
              max-height="90%"
              max-width="90%"
            ></v-img>
            <div class="zoom-controls">
              <v-btn icon="mdi-magnify-minus-outline" @click="zoomOut" class="mx-1" title="Zoom Out"></v-btn>
              <v-btn icon="mdi-fit-to-screen-outline" @click="resetZoom" class="mx-1" title="Reset Zoom"></v-btn>
              <v-btn icon="mdi-magnify-plus-outline" @click="zoomIn" class="mx-1" title="Zoom In"></v-btn>
            </div>
          </template>
          <template v-else-if="selectedProofItem.type.startsWith('video/')">
            <video
              :src="selectedProofItem.url"
              controls
              autoplay
              playsinline
              preload="auto"
              @error="handleMediaDisplayError(selectedProofItem.url, 'video-dialog')"
              style="max-height: 90%; max-width: 90%; width: auto; height: auto; object-fit: contain; background-color: black;"
            >
              Your browser does not support the video tag.
            </video>
          </template>
          <template v-else>
            <div class="pa-4 text-center text-white">
              <v-icon size="96" color="white">mdi-file-question-outline</v-icon>
              <p class="text-h6 mt-4">Cannot display preview for this file type.</p>
              <p class="text-caption">File type: {{ selectedProofItem.type || 'Unknown' }}</p>
            </div>
          </template>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- NEW: Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Complaint Details</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="printDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-btn icon dark @click="printContent">
            <v-icon>mdi-printer</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-8">
          <div id="print-area">
            <h3 class="text-h5 text-center mb-6">Complaint Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <br>
                Reference #: <span class="font-weight-bold">{{ form.ref_no }}</span>
            </p>
            
            <h4 class="text-h6 font-weight-bold mt-6 mb-2">Complainant Information</h4>
            <table class="print-detail-table">
              <tr><th>Name:</th><td>{{ form.complainant_display_name }}</td></tr>
              <tr><th>Address:</th><td>{{ form.complainant_address }}</td></tr>
              <tr><th>Contact No.:</th><td>{{ form.contact_number }}</td></tr>
            </table>

            <h4 class="text-h6 font-weight-bold mt-6 mb-2">Complaint Details</h4>
            <table class="print-detail-table">
              <tr><th>Category:</th><td>{{ form.category }}</td></tr>
              <tr><th>Date of Complaint:</th><td>{{ form.date_of_complaint }}</td></tr>
              <tr><th>Time of Complaint:</th><td>{{ form.time_of_complaint }}</td></tr>
              <tr><th>Person Complained Against:</th><td>{{ form.person_complained_against_name }}</td></tr>
              <tr><th>Status:</th><td>{{ form.status }} <span v-if="form.status_reason"> (Reason: {{ form.status_reason }})</span></td></tr>
              <tr><th colspan="2">Description:</th></tr>
              <tr><td colspan="2" style="white-space: pre-wrap;">{{ form.notes_description }}</td></tr>
            </table>

            <h4 class="text-h6 font-weight-bold mt-6 mb-2">Proof of Complaint</h4>
            <div v-if="form.proofs_display && form.proofs_display.length > 0">
              <p class="text-body-2 mb-2">Attached proofs ({{ form.proofs_display.length }} items):</p>
              <div class="proofs-print-grid">
                <div v-for="(proof, idx) in form.proofs_display" :key="idx" class="proof-item-print">
                  <template v-if="proof.type.startsWith('image/')">
                    <img :src="proof.url" style="max-width: 100%; height: auto; display: block; margin-bottom: 5px;"/>
                  </template>
                  <template v-else-if="proof.type.startsWith('video/')">
                    <video :src="proof.url" controls style="max-width: 100%; height: auto; display: block; margin-bottom: 5px;">
                      Your browser does not support the video tag.
                    </video>
                  </template>
                  <template v-else>
                    <p class="text-caption">File: {{ proof.type }}</p>
                  </template>
                  <p class="text-caption mt-1">Type: {{ proof.type }}</p>
                </div>
              </div>
              <!-- <p class="text-caption text-red-darken-2 mt-2">Note: Embedding many large files can affect printing performance and paper usage.</p> -->
            </div>
            <p v-else class="text-body-2">No proof was attached.</p>

            <h4 class="text-h6 font-weight-bold mt-6 mb-2">Investigation Notes</h4>
            <div v-if="investigationNotes.length > 0">
              <div v-for="note in investigationNotes" :key="note._id" class="mb-3 print-note-item">
                <p class="text-caption text-grey-darken-1 mb-0">
                  {{ formatDateTime(note.createdAt) }} by <span class="font-weight-bold">{{ note.author?.name || 'System' }}</span>
                </p>
                <p class="text-body-2 mt-1" style="white-space: pre-wrap;">{{ note.content }}</p>
              </div>
            </div>
            <p v-else class="text-body-2">No investigation notes have been added yet.</p>

            <p class="text-caption text-center mt-6">Generated by B-bud System.</p>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Make sure this path is correct

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const complaintId = route.params.id;

// --- STATE ---
const form = reactive({
  ref_no: '',
  complainant_resident_id: null,
  complainant_display_name: '',
  complainant_address: '',
  contact_number: '',
  date_of_complaint: '',
  time_of_complaint: '',
  person_complained_against_resident_id: null,
  person_complained_against_name: '',
  status: 'New',
  notes_description: '',
  category: '',
  proofs_base64: [], // This will still hold the raw base64 strings from backend
  proofs_display: [], // NEW: This will hold objects {url: base64, type: mimetype} for display
  complainant_details: null,
  status_reason: '',
});

const complaintCategories = ref([
  'Theft / Robbery', 'Scam / Fraud', 'Physical Assault / Violence', 'Verbal Abuse / Threats',
  'Sexual Harassment / Abuse', 'Vandalism', 'Noise Disturbance', 'Illegal Parking / Obstruction',
  'Drunk and Disorderly Behavior', 'Curfew Violation / Minor Offenses', 'Illegal Gambling',
  'Animal Nuisance / Stray Animal Concern', 'Garbage / Sanitation Complaints',
  'Boundary Disputes / Trespassing', 'Barangay Staff / Official Misconduct', 'Others',
]);

const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const showProofDialog = ref(false);
const selectedProofItem = ref({ url: '', type: '' }); // NEW: To store both URL and type for the dialog

// NEW: State for Dismiss complaint dialog
const declineComplaintDialog = ref(false);
const dismissReason = ref('');
const isActing = ref(false); // Used for loading states on actions

const zoomLevel = ref(1);

const complainantSearchQuery = ref('');
const complainantSearchResults = ref([]);
const isLoadingComplainants = ref(false);

const personComplainedSearchQuery = ref('');
const personComplainedSearchResults = ref([]);
const isLoadingPersonComplained = ref(false);

const investigationNotes = ref([]);
const newNoteContent = ref('');
const notesLoading = ref(false);
const addingNote = ref(false);

// NEW: Print Dialog state
const printDialog = ref(false);

// --- VUELIDATE ---
const rules = {
    complainant_resident_id: { required: helpers.withMessage('A complainant must be selected.', required) },
    complainant_address: { required },
    contact_number: { required },
    date_of_complaint: { required },
    time_of_complaint: { required },
    person_complained_against_name: { required: helpers.withMessage('The person being complained against is required.', required) },
    notes_description: { required },
    category: { required },
};
const v$ = useVuelidate(rules, form);

// --- STATUS TRACKER CONFIGURATION (NEW) ---
const STATUS_CONFIG = {
  'New':                 { color: 'info', icon: 'mdi-bell-ring-outline' },
  'Under Investigation': { color: 'warning', icon: 'mdi-magnify-scan' },
  'Unresolved':          { color: 'blue-grey-darken-3', icon: 'mdi-alert-circle-outline' },
  'Resolved':            { color: 'success', icon: 'mdi-check-circle-outline' },
  'Closed':              { color: 'grey-darken-1', icon: 'mdi-archive-outline' },
  'Dismissed':           { color: 'error', icon: 'mdi-cancel' },
};
const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'grey';
const getStatusIcon = (status) => STATUS_CONFIG[status]?.icon || 'mdi-help-circle-outline';

const trackerSteps = ref([
    { name: 'New', icon: STATUS_CONFIG.New.icon },
    { name: 'Under Investigation', icon: STATUS_CONFIG['Under Investigation'].icon },
    { name: 'Unresolved', icon: STATUS_CONFIG.Unresolved.icon }, // Added as a distinct step
    { name: 'Resolved', icon: STATUS_CONFIG.Resolved.icon },
    { name: 'Closed', icon: STATUS_CONFIG.Closed.icon }
]);

const isDismissed = computed(() => form.status === 'Dismissed');
const isFailureState = computed(() => isDismissed.value);

const activeStepIndex = computed(() => {
  if (!form.status) return -1;

  const currentStatus = form.status;
  const stepNames = trackerSteps.value.map(step => step.name);

  // Handle failure state (Dismissed)
  if (isDismissed.value) {
    // If dismissed, mark 'Under Investigation' as the failure point (index 1)
    return stepNames.indexOf('Under Investigation');
  }

  // Handle normal progression, including 'Unresolved'
  return stepNames.indexOf(currentStatus);
});

const progressWidth = computed(() => {
  if (activeStepIndex.value < 0) return '0%';
  const totalStepsForProgressBar = trackerSteps.value.length > 1 ? (trackerSteps.value.length - 1) : 1;
  const percentage = (activeStepIndex.value / totalStepsForProgressBar) * 100;
  return `${percentage}%`;
});

// Helper function for step icons (copied from document requests)
function getStepIcon(index, defaultIcon) {
    if (isFailureState.value) {
        if (index < activeStepIndex.value) return 'mdi-check';
        if (index === activeStepIndex.value) return 'mdi-close';
        return defaultIcon;
    }
    if (index < activeStepIndex.value) {
        return 'mdi-check';
    }
    return defaultIcon;
}
// --- END STATUS TRACKER CONFIGURATION ---


// --- COMPUTED PROPERTIES ---
const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value})`,
  transition: 'transform 0.2s ease-out'
}));

const isComplainantDeactivated = computed(() => {
    return form.complainant_details && (form.complainant_details.status === 'Deactivated' || form.complainant_details.account_status === 'Deactivated');
});


// --- FUNCTIONS ---
async function updateComplaintStatus(status, reason = '') {
  isActing.value = true;
  const body = { status };
  if (reason) {
    body.reason = reason;
  }

  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintId}/status`, { method: 'PATCH', body });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update status.');
    
    $toast.fire({ title: data.value.message || 'Status updated successfully!', icon: 'success' });
    await fetchComplaint();
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    isActing.value = false;
  }
}

async function confirmDismiss() {
    if (!dismissReason.value.trim()) {
        $toast.fire({ title: 'A reason is required to dismiss the complaint.', icon: 'warning' });
        return;
    }
    await updateComplaintStatus('Dismissed', dismissReason.value.trim());
    declineComplaintDialog.value = false;
    dismissReason.value = '';
}


onMounted(async () => {
  await fetchComplaint();
});

async function fetchComplaint(){
    loading.value = true;
    try {
        const { data, error } = await useMyFetch(`/api/complaints/${complaintId}`);
        if (error.value || !data.value?.complaint) throw new Error('Complaint not found.');
        const complaint = data.value.complaint;
        
        Object.assign(form, {
            ...complaint,
            date_of_complaint: formatDateForInput(complaint.date_of_complaint, 'date'),
            time_of_complaint: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(complaint.created_at)), // Use created_at for time
            complainant_details: complaint.complainant_details || null,
            status_reason: complaint.status_reason || ''
        });

        // NEW: Process proofs_base64 for display
        if (complaint.proofs_base64 && complaint.proofs_base64.length > 0) {
            form.proofs_display = complaint.proofs_base64.map(base64String => {
                if (base64String.startsWith('data:')) {
                    const mimeMatch = base64String.match(/^data:(.*?);base64,/);
                    const type = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                    return { url: base64String, type: type };
                }
                console.warn("Proof string is not a data URL:", base64String);
                return { url: base64String, type: 'application/octet-stream' }; // Fallback
            });
        } else {
            form.proofs_display = [];
        }

        console.log('Time of complaint: ', complaint.created_at);
        originalFormState.value = JSON.parse(JSON.stringify(form));
        complainantSearchQuery.value = form.complainant_display_name;
        personComplainedSearchQuery.value = form.person_complained_against_name;
        // UPDATED: Include 'Unresolved' for fetching notes
        if (['Under Investigation', 'Resolved', 'Dismissed', 'Unresolved'].includes(form.status)) {
          await fetchNotes();
        } else {
          investigationNotes.value = [];
        }
    } catch (e) { $toast.fire({ title: e.message, icon: 'error' }); router.push('/complaints'); }
    finally { loading.value = false; }
}

const cancelEdit = () => { Object.assign(form, originalFormState.value); v$.value.$reset(); editMode.value = false; };

// UPDATED: openProofDialog now takes the full proofItem object
const openProofDialog = (proofItem) => {
  selectedProofItem.value = { ...proofItem }; // Create a copy
  zoomLevel.value = 1;
  showProofDialog.value = true;
};

// NEW: Error handler for media elements
const handleMediaDisplayError = (url, type) => {
  console.error(`[Media Display Error] Failed to load ${type} from URL: ${url}. Check console for CSP errors or file corruption.`);
  $toast.fire({ title: `Could not display ${type}. It might be corrupted or blocked by security policy.`, icon: 'error' });
};


const zoomIn = () => { zoomLevel.value += 0.2; };
const zoomOut = () => { zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.2); };
const resetZoom = () => { zoomLevel.value = 1; };

const debounce = (fn,delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this,a), delay); }; };
const searchResidentsAPI = debounce(async (query, type) => {
    const loadingRef = type === 'complainant' ? isLoadingComplainants : isLoadingPersonComplained;
    const resultsRef = type === 'complainant' ? complainantSearchResults : personComplainedSearchResults;
    if (!query || query.trim().length < 2) { resultsRef.value = []; return; }
    loadingRef.value = true;
    try {
        const { data, error } = await useMyFetch('/api/residents/search', { query: { q: query } });
        if (error.value) throw new Error(`Error searching residents.`);
        resultsRef.value = data.value?.residents.map(r => ({
            _id: r._id, name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email, address: `${r.address_house_number||''} ${r.address_street||''}, ${r.address_subdivision_zone||''}`, contact_number: r.contact_number
        })) || [];
    } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
    finally { loadingRef.value = false; }
}, 500);

watch(complainantSearchQuery, (nq) => { if (editMode.value && nq !== form.complainant_display_name) searchResidentsAPI(nq, 'complainant'); });
watch(personComplainedSearchQuery, (nq) => {
    if (editMode.value) {
        form.person_complained_against_name = nq;
        if (nq !== form.person_complained_against_name) form.person_complained_against_resident_id = null;
        searchResidentsAPI(nq, 'personComplained');
    }
});

// UPDATED: Include 'Unresolved' for fetching notes
watch(() => form.status, (newStatus, oldStatus) => {
  if (newStatus !== oldStatus && ['Under Investigation', 'Resolved', 'Dismissed', 'Unresolved'].includes(newStatus)) {
    fetchNotes();
  } else if (newStatus === 'New' || newStatus === 'Closed') {
    investigationNotes.value = [];
  }
});

const onComplainantSelect = (selectedId) => {
    const resident = complainantSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    form.complainant_resident_id = resident._id; form.complainant_display_name = resident.name;
    form.complainant_address = resident.address; form.contact_number = resident.contact_number; 
    complainantSearchQuery.value = resident.name; complainantSearchResults.value = [];
};

const onPersonComplainedSelect = (selectedId) => {
    const resident = personComplainedSearchResults.value.find(r => r._id === selectedId);
    if (!resident) return;
    form.person_complained_against_resident_id = resident._id;
    form.person_complained_against_name = resident.name;
    personComplainedSearchQuery.value = resident.name;
    personComplainedSearchResults.value = [];
};

async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  saving.value = true;
  try {
    // Backend expects array of base64 strings, not the processed objects
    const payload = { 
      ...form, 
      date_of_complaint: new Date(form.date_of_complaint).toISOString(),
      proofs_base64: form.proofs_base64 // Send back the original raw base64 strings
    };
    delete payload.status;
    delete payload.complainant_details;
    delete payload.status_reason;
    delete payload.proofs_display; // Don't send the display helper array
    const { error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'PUT', body: payload });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to update complaint.');
    $toast.fire({ title: 'Complaint updated successfully!', icon: 'success' });
    await fetchComplaint();
    editMode.value = false;
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteComplaint(){
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/complaints/${complaintId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete complaint.');
    $toast.fire({ title: 'Complaint deleted successfully!', icon: 'success' });
    router.push('/complaints');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}

async function fetchNotes() {
  notesLoading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/complaints/${complaintId}/notes`);
    if (error.value) throw new Error('Failed to fetch investigation notes.');
    investigationNotes.value = (data.value?.notes || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    investigationNotes.value = [];
  } finally {
    notesLoading.value = false;
  }
}

async function addNote() {
  if (!newNoteContent.value.trim()) {
    $toast.fire({ title: 'Note content cannot be empty.', icon: 'warning' });
    return;
  }
  addingNote.value = true;
  try {
    const { error } = await useMyFetch(`/api/complaints/${complaintId}/notes`, {
      method: 'POST',
      body: { content: newNoteContent.value.trim() }
    });
    if (error.value) throw new Error('Failed to add note.');
    $toast.fire({ title: 'Note added successfully!', icon: 'success' });
    newNoteContent.value = '';
    await fetchNotes();
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    addingNote.value = false;
  }
}

const formatDateForInput = (iso, type='date') => { if (!iso) return ''; const d = new Date(iso); return type === 'date' ? d.toISOString().split('T')[0] : d.toTimeString().slice(0,5); };
const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
};

// --- NEW PRINT FUNCTIONS ---
const openPrintDialog = () => {
  printDialog.value = true;
};

const printContent = () => {
  const printContentDiv = document.getElementById('print-area');
  if (!printContentDiv) {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
    return;
  }

  const proofsHtml = form.proofs_display && form.proofs_display.length > 0
    ? `
      <p class="text-body-2 mb-2">Attached proofs (${form.proofs_display.length} items):</p>
      <div class="proofs-print-grid">
        ${form.proofs_display.map(proof => `
          <div class="proof-item-print">
            ${proof.type.startsWith('image/') ? `<img src="${proof.url}" style="max-width: 100%; height: auto; display: block; margin-bottom: 5px;"/>` : ''}
            ${proof.type.startsWith('video/') ? `<video src="${proof.url}" controls style="max-width: 100%; height: auto; display: block; margin-bottom: 5px;">Your browser does not support the video tag.</video>` : ''}
            ${!proof.type.startsWith('image/') && !proof.type.startsWith('video/') ? `<p class="text-caption">File: ${proof.type}</p>` : ''}
            <p class="text-caption mt-1">Type: ${proof.type}</p>
          </div>
        `).join('')}
      </div>
    `
    : `<p class="text-body-2">No proof was attached.</p>`;

  const notesHtml = investigationNotes.value.length > 0
    ? investigationNotes.value.map(note => `
      <div class="mb-3 print-note-item">
        <p class="text-caption text-grey-darken-1 mb-0">
          ${formatDateTime(note.createdAt)} by <span class="font-weight-bold">${note.author?.name || 'System'}</span>
        </p>
        <p class="text-body-2 mt-1" style="white-space: pre-wrap;">${note.content}</p>
      </div>
    `).join('')
    : `<p class="text-body-2">No investigation notes have been added yet.</p>`;


  const printHtml = `
    <html>
      <head>
        <title>Complaint Report - ${form.ref_no}</title>
        <style>
          /* Basic print styles */
          body { font-family: sans-serif; margin: 20px; color: #333; }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .print-logo {
            max-width: 100px; /* Adjust size as needed */
            height: auto;
            display: block;
            margin: 0 auto 10px auto; /* Center with some bottom margin */
          }
          .print-app-name {
            font-size: 1.5em; /* Adjust size as needed */
            font-weight: bold;
            margin-bottom: 10px;
          }
          h3 { text-align: center; margin-bottom: 20px; color: #333; }
          p { text-align: center; margin-bottom: 15px; color: #555; }
          
          .print-detail-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .print-detail-table th, .print-detail-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            vertical-align: top;
            font-size: 0.9em;
          }
          .print-detail-table th {
            background-color: #f2f2f2;
            font-weight: bold;
            width: 25%; /* Adjust as needed */
          }
          .print-note-item {
              border-left: 3px solid #ccc;
              padding-left: 10px;
              margin-bottom: 10px;
          }
          .text-caption {
            font-size: 0.75em;
            color: #777;
          }
          .proofs-print-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
              gap: 15px;
              margin-top: 10px;
          }
          .proof-item-print {
              border: 1px solid #eee;
              padding: 10px;
              text-align: center;
              background-color: #fcfcfc;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <img src="${logoImage}" alt="B-Bud Logo" class="print-logo" />
          <div class="print-app-name">B-Bud</div>
        </div>
        <div id="print-area-content">
          <h3 class="text-h5 text-center mb-6">Complaint Report</h3>
          <p class="text-center text-grey-darken-1 mb-4">
              Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              <br>
              Reference #: <span class="font-weight-bold">${form.ref_no}</span>
          </p>
          
          <h4 class="text-h6 font-weight-bold mt-6 mb-2">Complainant Information</h4>
          <table class="print-detail-table">
            <tr><th>Name:</th><td>${form.complainant_display_name}</td></tr>
            <tr><th>Address:</th><td>${form.complainant_address}</td></tr>
            <tr><th>Contact No.:</th><td>${form.contact_number}</td></tr>
          </table>

          <h4 class="text-h6 font-weight-bold mt-6 mb-2">Complaint Details</h4>
          <table class="print-detail-table">
            <tr><th>Category:</th><td>${form.category}</td></tr>
            <tr><th>Date of Complaint:</th><td>${form.date_of_complaint}</td></tr>
            <tr><th>Time of Complaint:</th><td>${form.time_of_complaint}</td></tr>
            <tr><th>Person Complained Against:</th><td>${form.person_complained_against_name}</td></tr>
            <tr><th>Status:</th><td>${form.status} ${form.status_reason ? ` (Reason: ${form.status_reason})` : ''}</td></tr>
            <tr><th colspan="2">Description:</th></tr>
            <tr><td colspan="2" style="white-space: pre-wrap;">${form.notes_description}</td></tr>
          </table>

          <h4 class="text-h6 font-weight-bold mt-6 mb-2">Proof of Complaint</h4>
          ${proofsHtml}

          <h4 class="text-h6 font-weight-bold mt-6 mb-2">Investigation Notes</h4>
          <div class="investigation-notes-print">
            ${notesHtml}
          </div>

          <p class="text-caption text-center mt-6">Generated by B-bud System.</p>
        </div>
      </body>
    </html>
  `; 
  
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    $toast.fire({ title: 'Pop-up blocked! Please allow pop-ups for this site to print.', icon: 'warning' });
    return;
  }

  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onafterprint = () => {
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    }, 100);
  };

  printWindow.print();
};
</script>

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
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

/* Reused from new.vue for consistent preview styling */
.image-video-preview-wrapper {
  width: 100%;
  padding-top: 100%; /* 1:1 Aspect Ratio */
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0; /* Light background to make empty space visible */
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-video-preview-wrapper .v-img,
.image-video-preview-wrapper video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* Ensure full content is visible */
}

/* Added for a subtle play icon on video previews */
.video-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none; /* Allows click to pass through to the wrapper */
  opacity: 0.7;
  transition: opacity 0.2s;
}
.image-video-preview-wrapper:hover .video-play-icon {
  opacity: 1;
}

/* Status Tracker Styles (Copied from document requests [id].vue) */
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
  top: 20px;
  left: 0;
  right: 0;
  width: 100%;
  padding: 0 40px;
  box-sizing: border-box;
  z-index: 1;
}
.progress-bar-bg, .progress-bar-fg {
  height: 4px;
  border-radius: 2px;
  position: absolute;
  top: 50%;
  width: 90%; /* Adjust if needed to fit tracker steps */
  transform: translateY(-50%);
}
.progress-bar-bg {
  width: 90%; /* Adjust if needed to fit tracker steps */
  background-color: #e0e0e0;
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
  width: 100px; /* Adjust width as needed for spacing */
}
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
  color: #9e9e9e;
  transition: color 0.4s;
}
.step-circle.current {
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.current .v-icon {
  color: rgb(var(--v-theme-primary));
}
.step-circle.completed {
  background-color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.step-circle.completed .v-icon {
  color: white;
}
.step-circle.declined { /* Used for steps before a failure point */
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
  font-size: 0.875em;
  color: #757575;
  transition: color 0.4s, font-weight 0.4s;
}

/* Print Specific Styles */
@media print {
  body > *:not(.v-overlay-container) {
    display: none !important;
  }
  .v-overlay-container {
    display: block !important;
    position: static;
    top: auto !important;
    left: auto !important;
    width: auto !important;
    height: auto !important;
    transform: none !important;
    overflow: visible !important;
  }

  .v-dialog--fullscreen.v-overlay__content {
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
    width: auto !important;
    max-width: none !important;
    min-width: none !important;
    position: static !important;
    display: block !important;
    overflow: visible !important;
  }

  .v-card {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    height: auto !important;
    width: auto !important;
  }
  
  .v-toolbar {
    display: none !important;
  }
  .v-card-text {
    padding: 0 !important;
  }
  #print-area {
    width: 100%;
    margin: 0;
    padding: 0;
  }
  /* Additional print styles for proofs */
  .proofs-print-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 10px;
  }
  .proof-item-print {
      border: 1px solid #eee;
      padding: 10px;
      text-align: center;
      background-color: #fcfcfc;
  }
  .proof-item-print img,
  .proof-item-print video {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto; /* Center images/videos */
  }
}
</style>