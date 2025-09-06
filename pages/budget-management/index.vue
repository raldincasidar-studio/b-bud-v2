<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Budget Management</h2>
          <p class="text-grey-darken-1">Manage budget entries and view financial records.</p>
        </v-col>
        <v-col class="text-right">
          <v-btn to="/budget-management/new" color="primary" size="large" prepend-icon="mdi-plus" class="mr-2">
            Add Budget
          </v-btn>
          <v-btn color="info" size="large" prepend-icon="mdi-printer" @click="printBudgetReport" :loading="loading">
            Print Report
          </v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-6" flat border>
        <v-card-title class="d-flex align-center pe-2">
            <v-icon icon="mdi-cash-search" class="me-2"></v-icon>
            Search Budget
            <v-spacer></v-spacer>
            <v-text-field
                v-model="searchKey"
                label="Search by Budget Name, Category, etc..."
                prepend-inner-icon="mdi-magnify"
                variant="solo-filled"
                flat
                hide-details
                single-line
            ></v-text-field>
        </v-card-title>
        <v-divider></v-divider>
        
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="filterBy"
                :items="filterOptions"
                label="Filter by"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
            <v-col v-if="filterBy === 'day'" cols="12" md="4">
              <v-menu
                v-model="showDayPicker"
                :close-on-content-click="false"
                :nudge-right="40"
                transition="scale-transition"
                offset-y
                min-width="auto"
              >
                <template v-slot:activator="{ props }">
                  <v-text-field
                    v-model="formattedSelectedDay"
                    label="Select Day"
                    prepend-icon="mdi-calendar"
                    readonly
                    v-bind="props"
                    variant="outlined"
                    hide-details
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="selectedDay"
                  @update:model-value="applyFilter"
                  no-title
                  scrollable
                ></v-date-picker>
              </v-menu>
            </v-col>
            <v-col v-if="filterBy === 'month'" cols="12" md="4">
              <v-select
                v-model="selectedMonth"
                :items="months"
                item-title="name"
                item-value="value"
                label="Select Month"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
            <v-col v-if="filterBy === 'year'" cols="12" md="4">
              <v-select
                v-model="selectedYear"
                :items="years"
                label="Select Year"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items-length="totalBudgets"
          :items="budgets"
          :loading="loading"
          :search="searchKey"
          @update:options="updateTable"
          class="elevation-0"
          item-value="_id"
        >
          <template v-slot:item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" :to="`/budget-management/${item._id}`" size="small">
              EDIT / DELETE
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

        </v-data-table-server>
      </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useMyFetch } from '@/composables/useMyFetch';

const headers = [
  { title: 'Budget Name', align: 'start', key: 'budgetName', sortable: true },
  { title: 'Category', align: 'start', key: 'category', sortable: true },
  { title: 'Amount', align: 'start', key: 'amount', sortable: false },
  { title: 'Date', align: 'start', key: 'date', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalBudgets = ref(0);
const budgets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

const filterBy = ref('');
const filterOptions = [
  { title: 'No Filter', value: '' },
  { title: 'Filter by Day', value: 'day' },
  { title: 'Filter by Month', value: 'month' },
  { title: 'Filter by Year', value: 'year' },
];

const showDayPicker = ref(false);
const selectedDay = ref(null);
const selectedMonth = ref(null);
const selectedYear = ref(new Date().getFullYear()); // Default to current year

const months = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(null, i + 1, null);
  return { name: date.toLocaleString('en-US', { month: 'long' }), value: i + 1 };
});
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

const formattedSelectedDay = computed(() => {
  return selectedDay.value ? new Date(selectedDay.value).toLocaleDateString('en-GB') : '';
});

watch(filterBy, (newVal) => {
  if (newVal === 'day') {
    selectedMonth.value = null;
    selectedYear.value = null; 
  } else if (newVal === 'month') {
    selectedDay.value = null;
    if (!selectedYear.value) selectedYear.value = new Date().getFullYear(); 
  } else if (newVal === 'year') {
    selectedDay.value = null;
    selectedMonth.value = null;
  } else {
    selectedDay.value = null;
    selectedMonth.value = null;
    selectedYear.value = new Date().getFullYear(); 
  }
  applyFilter();
});

async function updateTable(options) {
  loading.value = true;
  
  const { page, itemsPerPage: newItemsPerPage, sortBy } = options;
  
  try {
    const sortByKey = sortBy.length ? sortBy[0].key : 'date'; 
    const sortOrder = sortBy.length ? sortBy[0].order : 'desc';   

    const queryParams = {
      search: searchKey.value, 
      page: page,
      itemsPerPage: newItemsPerPage,
      sortBy: sortByKey,
      sortOrder: sortOrder,
    };

    if (filterBy.value === 'day' && selectedDay.value) {
      const date = new Date(selectedDay.value);
      if (!isNaN(date)) {
        queryParams.filterDay = date.toISOString().split('T')[0];
      }
    } else if (filterBy.value === 'month' && selectedMonth.value) {
      queryParams.filterMonth = selectedMonth.value;
      queryParams.filterYear = selectedYear.value || new Date().getFullYear(); 
    } else if (filterBy.value === 'year' && selectedYear.value) {
      queryParams.filterYear = selectedYear.value;
    }

    const { data, error } = await useMyFetch('/api/budgets', {
      query: queryParams
    });

    if (error.value) {
        console.error("Failed to fetch budgets:", error.value);
        budgets.value = [];
        totalBudgets.value = 0;
    } else {
        budgets.value = data.value?.budgets;
        totalBudgets.value = data.value?.totalBudgets;
    }

  } catch (err) {
      console.error("An exception occurred while fetching budgets:", err);
  } finally {
      loading.value = false;
  }
}

const applyFilter = () => {
  updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  showDayPicker.value = false;
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
};

// --- Print Functionality ---
async function printBudgetReport() {
    loading.value = true;
    try {
        const reportYear = selectedYear.value || new Date().getFullYear();

        const queryParams = {
            itemsPerPage: -1, // Request all items for the report
            sortBy: 'date',
            sortOrder: 'asc',
        };

        if (filterBy.value === 'day' && selectedDay.value) {
            const date = new Date(selectedDay.value);
            if (!isNaN(date)) {
                queryParams.filterDay = date.toISOString().split('T')[0];
            }
        } else if (filterBy.value === 'month' && selectedMonth.value) {
            queryParams.filterMonth = selectedMonth.value;
            queryParams.filterYear = reportYear; 
        } else if (filterBy.value === 'year') {
            queryParams.filterYear = selectedYear.value; 
        } else { 
            queryParams.filterYear = reportYear;
        }

        const { data: allBudgetsData, error: allBudgetsError } = await useMyFetch('/api/budgets', {
            query: queryParams
        });

        if (allBudgetsError.value) { 
            console.error("Failed to fetch all budgets for report:", allBudgetsError.value);
            alert("Could not generate report: Failed to fetch budget data.");
            return;
        }

        // --- Fetch logos from backend endpoint ---
        const { data: logoData, error: logoError } = await useMyFetch('/api/logos');
        if (logoError.value) {
            console.error("Failed to fetch logos:", logoError.value);
            alert("Could not generate report: Failed to fetch logo data.");
            return;
        }
        // Destructure all three specific logo Base64 strings
        const { manilaLogo, bagongPilipinasLogo, cityBudgetLogo } = logoData.value;
        // --- END Fetch logos ---

        const allBudgets = allBudgetsData.value?.budgets || [];
        
        // Pass all three fetched Base64 logo strings to the generatePrintContent function
        const printContent = generatePrintContent(
            allBudgets, 
            reportYear, 
            manilaLogo, 
            bagongPilipinasLogo, 
            cityBudgetLogo // This is the logo for the City Budget Office
        );
        
        const printWindow = window.open('', '_blank', 'height=800,width=1200');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            // printWindow.onafterprint = () => printWindow.close(); 
        } else {
            alert('Please allow pop-ups for printing.');
        }

    } catch (err) {
        console.error("Error generating print report:", err);
        alert("An error occurred while preparing the print report.");
    } finally {
        loading.value = false;
    }
}

// Updated generatePrintContent to accept three distinct Base64 logo parameters
function generatePrintContent(budgetsForReport, reportYear, manilaLogoBase64, bagongPilipinasLogoBase64, cityBudgetLogoBase64) {
    // Helper function for currency formatting in the print content
    const formatPrintCurrency = (amount) => {
        return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // --- DEBUGGING: Log the received data for the report ---
    console.log("Budgets received for print report (budgetsForReport):", budgetsForReport);
    console.log("Manila Logo Base64:", manilaLogoBase64 ? manilaLogoBase64.substring(0, 50) + "..." : "Not provided");
    console.log("Bagong Pilipinas Logo Base64:", bagongPilipinasLogoBase64 ? bagongPilipinasLogoBase64.substring(0, 50) + "..." : "Not provided");
    console.log("City Budget Logo Base64:", cityBudgetLogoBase64 ? cityBudgetLogoBase64.substring(0, 50) + "..." : "Not provided");
    // --- END DEBUGGING ---

    // Group budgets by category
    const groupedBudgets = budgetsForReport.reduce((acc, item) => {
        const category = item.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = { items: [], total: 0 };
        }
        const amount = parseFloat(item.amount) || 0;
        acc[category].items.push({ budgetName: item.budgetName, amount: amount });
        acc[category].total += amount;
        return acc;
    }, {});

    let totalExpenditures = 0;
    let expenditureHtml = '';

    // Generate HTML for each category
    for (const categoryName in groupedBudgets) {
        const categoryData = groupedBudgets[categoryName];
        totalExpenditures += categoryData.total;

        expenditureHtml += `
            <tr>
                <td class="no-indent"><b>${categoryName}</b></td>
                <td class="amount-col-sub nowrap">P</td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(categoryData.total)}</td>
            </tr>
        `;
        categoryData.items.forEach((item, index) => {
            expenditureHtml += `
                <tr>
                    <td class="indent-1">${String.fromCharCode(97 + index)}. ${item.budgetName}</td>
                    <td class="amount-col-sub nowrap">P</td>
                    <td class="amount-col-total nowrap">${formatPrintCurrency(item.amount)}</td>
                </tr>
            `;
        });
    }

    // Hardcoded Income Values from the provided image
    const beginningBalance = 0;
    const rptShareCY2022 = 0;
    const ntaShare = 0;
    const rptShareOther = 0; 
    const otherIncome = 0;

    const totalAvailableResources = beginningBalance + rptShareCY2022 + ntaShare + rptShareOther + otherIncome;
    
    // Placeholder for Barangay Name - replace with dynamic value if available
    const barangayInfo = "436, Zone 44, District 4"; // Specific from the image

    const totalAppropriationAmountFormatted = formatPrintCurrency(totalAvailableResources);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Barangay Budget Report - CY ${reportYear}</title>
        <style>
            body { font-family: 'Times New Roman', serif; margin: 20mm; font-size: 11pt; }
            .header { text-align: center; margin-bottom: 20px; }
            .header-top-row {
                display: flex;
                justify-content: space-between; /* Pushes items to the ends */
                align-items: flex-start; /* Aligns items to the top */
                margin-bottom: 5px;
                width: 100%;
                box-sizing: border-box; /* Include padding in width calculation */
            }
            .header-text-block {
                flex-grow: 1; /* Allows text to take available space */
                text-align: center;
                line-height: 1.2;
                padding: 0 10px; /* Small padding to prevent text/logos from touching */
            }
            .header-text-block p { margin: 2px 0; }
            .title { font-weight: bold; font-size: 13pt; margin-bottom: 15px; }
            .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: none; padding: 2px 5px; text-align: left; vertical-align: top;}
            .amount-col { text-align: right; width: 100px; }
            .amount-col-sub { text-align: right; width: 80px; }
            .amount-col-total { text-align: right; width: 120px; }
            .total-row { font-weight: bold; border-top: 1px solid black; }
            .grand-total-row { font-weight: bold; border-top: 2px double black; }
            .no-indent { padding-left: 0; }
            .indent-1 { padding-left: 20px; }
            .indent-2 { padding-left: 40px; }

            /* Styles for logos */
            .logo {
                height: 100px; /* Increased height */
                width: auto;
                object-fit: contain;
            }
            .city-budget-logo-top-center {
                height: 100px; /* Increased height */
                width: auto;
                object-fit: contain;
                display: block; /* Important for centering with margin auto */
                margin: 0 auto 5px auto; /* Center it above the text and add space */
            }
            
            /* Specific style to prevent line breaks in specific cells if possible */
            .nowrap { white-space: nowrap; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-top-row">
                <!-- Left Logo: Manila Logo -->
                <div style="flex-shrink: 0;">
                    ${manilaLogoBase64 ? `<img src="${manilaLogoBase64}" alt="Manila Logo" class="logo" />` : ''}
                </div>
                
                <div class="header-text-block">
                    <!-- Center Top Logo: City Budget Logo -->
                    ${cityBudgetLogoBase64 ? `<img src="${cityBudgetLogoBase64}" alt="City Budget Logo" class="city-budget-logo-top-center" />` : ''}
                    <p>Republic of the Philippines</p>
                    <p>City of Manila</p>
                    <p>CITY BUDGET OFFICE</p>
                </div>
                
                <!-- Right Logo: Bagong Pilipinas Logo -->
                <div style="flex-shrink: 0;">
                    ${bagongPilipinasLogoBase64 ? `<img src="${bagongPilipinasLogoBase64}" alt="Bagong Pilipinas Logo" class="logo" />` : ''}
                </div>
            </div>
            
            <br>
            <p style="font-size: 10pt; text-align: left;">
                The Honorable Vice Mayor and Presiding Officer<br>
                and Members of the Sangguniang Panlungsod<br>
                Manila
            </p>
            <p style="font-size: 10pt; text-align: left;">
                Ladies and Gentlemen:
            </p>
            <p style="font-size: 10pt; text-align: justify; text-indent: 20px;">
                Forwarded pursuant to Section 333 of RA 7160 is the Annual Budget for CY ${reportYear} of Barangay ${barangayInfo} with a total appropriation amounting to ${totalAppropriationAmountFormatted} only. 
                it was approved under Barangay Appropriation Ordinance No. 01 series of ${reportYear} on February 01, ${reportYear} and received by this office on June 03, ${reportYear}. The budget was prepared pursuant to LBM No. 87 – A dated December 28,2023.
            </p>
            <p style="font-size: 10pt; text-align: justify; text-indent: 20px;">
                The estimated income, certified as available for appropriation by the Barangay Chairman and Barangay Treasurer and Officer-in-Charge, City Accountant and the proposed expenditures as shown below are in consonance with the New Government Accounting System (No As).
            </p>
        </div>

        <p class="section-title">Estimated Income for Budget</p>
        <table>
            <tr>
                <td class="no-indent">Beginning Balance</td>
                <td class="amount-col-sub nowrap">P</td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(beginningBalance)}</td>
            </tr>
            <tr>
                <td class="no-indent">Share on Real Property Tax CY 2022</td>
                <td class="amount-col-sub nowrap">P</td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(rptShareCY2022)}</td>
            </tr>
            <tr>
                <td class="no-indent">Share from National Tax Allotment</td>
                <td class="amount-col-sub"></td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(ntaShare)}</td>
            </tr>
            <tr>
                <td class="no-indent">Share on Real Property Tax</td>
                <td class="amount-col-sub"></td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(rptShareOther)}</td>
            </tr>
            <tr>
                <td class="no-indent">Other income</td>
                <td class="amount-col-sub"></td>
                <td class="amount-col-total nowrap">${formatPrintCurrency(otherIncome)}</td>
            </tr>
            <tr class="total-row">
                <td class="no-indent"><b>Total Available Resources</b></td>
                <td class="amount-col-sub nowrap"><b>P</b></td>
                <td class="amount-col-total nowrap"><b>${formatPrintCurrency(totalAvailableResources)}</b></td>
            </tr>
        </table>

        <p class="section-title">Expenditures:</p>
        <table>
            ${expenditureHtml}
            <tr class="grand-total-row">
                <td class="no-indent"><b>Total Expenditures</b></td>
                <td class="amount-col-sub nowrap"><b>P</b></td>
                <td class="amount-col-total nowrap"><b>${formatPrintCurrency(totalExpenditures)}</b></td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

// Initial load of the table data
updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
</script>