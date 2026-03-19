# eionet2-azure-functions

[![GitHub release](https://img.shields.io/github/v/release/eea/eionet2-azure-functions)](https://github.com/eea/eionet2-azure-functions/releases)



## Getting started

The application is build as a JavaScript application that contains Time trigger (running using a schedule defined by a cron expression) and Http trigger azure functions.

The output information is used for various reports, such as Eionet dashboard and statistics.

## Configuration.

In order to simplify the configuration the processors are grouped under several jobs in the structure detailed below.

The application uses a number of keys. All keys are stored in azure under Environment variables. The first set of keys are related to Microsoft Graph and Sharepoint connection.

    # After registering the app in Azure (App registrations) fill the fields below with appropiate values
    TENANT_ID= 
    CLIENT_ID=
    # Generate Client Secret. This is the "value" of the secret
    CLIENT_SECRET=
    # Endpoints
    AAD_ENDPOINT=https://login.microsoftonline.com
    GRAPH_ENDPOINT=https://graph.microsoft.com
    SHAREPOINT_SITE_ID= # Site ID of the -EXT-EionetConfiguration Site - with the lists
    SECONDARY_SHAREPOINT_SITE_ID=  # Site ID of the site with the Individual consultation lists -EXT-Eionet
    CONFIGURATION_LIST_ID= # The configuration list ID, stored in the -EXT-EionetConfiguration Site
    REACT_APP_REPORTNET3_KEY - contains auth key for accessing Reportnet API

The second set of keys are related to specific functions. 

The keys disable a functions if set to true. If set to false or missing the function is enabled. A key must be present only once. Removing the key has the same effect as setting it to true. The keys can be found in the Functions sections below. The keys that enable/disable a fucntion have the structure required by Azure functions engine.

    AzureWebJobs.{Name of functions}.Disabled

Also each time trigger function has a key specifying the cron expression for the running schedule.

## Time trigger functions

### AttendanceConsultations

    Config key: AzureWebJobs.AttendanceConsultations.Disabled
    Schedule key: ATTENDANCE_CONS_SCHEDULE

This function runs two processors described bellow:

#### Consultation respondants
Updates *Respondants* field on the consultation list. Each consultation has a reference to a list in the SECONDARY_SHAREPOINT_SITE_ID. From that list the countries are taken and updated in the Respondants field.

    Filters: ConsultationListId not null and StartDate <= Current time and Closed >= Current time

#### Meeting attendance
Processes meetings from the "Events list" and extracts the participants from the Graph API attendance records. Saves the participants in the *Event participants list*.
It either goes through those events which have **not** been processed before, as well as those which have already been processed and where the meeting end date is less than 12 hours ago. 
THis is to capture a) Older meetings, which have not been captured by the script, e.g. because it did not run regularly b) To capture participants in e.g. multi-day meetings where the initial attendance whcih was covered is not the final one 

    Filters: (Processed = 0 AND MeetingStart <= Current time) OR (Processed = 1 AND MeetingEnd >= (Current time - 12 hours))

### MeetingFields    

    Config key: AzureWebJobs.MeetingFields.Disabled
    Schedule key: MEETINGFIELDS_SCHEDULE

This job updates several fields in the "Events list". It runs on all future meetings as well as those in the past 14 weeks. 
This is to generate the "MeetingLink" from the ID for future meetings, and update the figures of participants, registrants and countries based on the "Participants list"
Updates fields in the Events list *MeetingLink, NoOfParticipants, NoOfRegistered, Countries* based on MeetingJoinId and information from participants list.
This job can run very freqently

    Filters: MeetingStart <= (Current time - 14 weeks)
    
### UserSingInNames

    Config key: AzureWebJobs.UserSignInNames.Disabled
    Schedule key: USERSIGNINNAMES_SCHEDULE

This function run two processors described bellow:

#### User names
Updates user display names in EEA Azure AD to include Country and NFP role if present. After update the user display name will have the following format: *John Doe (DE)* or *Jane Doe (NFP-FR)*

    Filters: SignedIn = 1 and SignedDate >= (Current time - 30 days)

#### Signed in users 
Updates the *SignedIn* field to true for users that have finalized sigining in. The information is taken from isMfaRegistered field in Graph API credentialUserRegistrationDetails report.
**For the moment requires the beta endpoint of the Graph API**

    Filters: SignedIn = 0 and SignedIn = null

### OrganisationFields

    Config key: AzureWebJobs.OrganisationFields.Disabled
    Schedule key: ORGANISATIONFIELDS_SCHEDULE

This job updates the fiels *Members* in the "Organisation list". It checks the "User list" and counts how many user are added for each organisation.
This job can run very freqently

    Filters: none

### Reportnet3Flows

    Config key: AzureWebJobs.Reportnet3Flows.Disabled
    Schedule key: REPORTNET3_SCHEDULE

Loads and saves in Sharepoint the reportnet 3 flows from Reportnet API. The API is configured in the configuration list. The new flows are inserted, the existing one are updated and the flows that are no longer returned by API are
removed from the list.

Fields copied directly: dataflowId, country, dataflowName, obligationName, obligationUrl, deadlineDate
Computed fields:
* dataflowUrl - public data flow url configured in configuration list (Reportnet2DataflowPublicUrl) + id of the dataflow,
* legalInstrumentName - sourceAlias field on the legalInstrument field inside obligation,
* legalInstrumentUrl - legalInstrumentLink field on the legalInstrument field inside obligation,
* isEEACore - copied from sharepoint ObligationsList
* status - if releasable flow is true then status is OPEN and it is CLOSED,
* reporterEmails - emails from leadReporters joined by comma ',',
* firstReleaseDate - first date from releasedDates ordered chronologically.
* lastReleaseDate - latest date from releasedDates ordered chronologically if the count of release dates is larger than 1,
* deliveryStatus - latest status from reportingDatasets if exists.

    Filters: none

   
## Http trigger (On-demand) functions, to be run manually for specific cases

### UserRemoval

    Config key : AzureWebJobs.UserRemoval.Disabled

Removes users that have not finalized the sign in process or users with no activity after a specified date. See also Configuration file.
This job is designed to be run manually because of the confirmation required. The url can be obtained from the Azure portal.

Calling the job endpoint directly lists the users that can be removed.

In order to remove the users it is necessary to add the key applyRemove with value true in the url.
    
    Filters: ((SignedIn = 0 or SignedIn = null) and CreatedDateTime < CurrentTime - configuration.RemoveNonSignedInUserNoOfDays)
        OR (LastSuccesfullSignDate < configuration.UserRemovalLastSignInDateTime)
    ConfigurationListEntry: RemoveNonSignedInUserNoOfDays
    ConfigurationListEntry: UserRemovalLastSignInDateTime

## Release

See [RELEASE.md](https://github.com/eea/eionet2-azure-functions/blob/master/RELEASE.md).

## How to contribute

For now the contributions are not open outside the internal EEA project team.

## Copyright and license

The Initial Owner of the Original Code is [European Environment Agency (EEA)](http://eea.europa.eu).
All Rights Reserved.

See [LICENSE.md](https://github.com/eea/eionet2-azure-functions/blob/master/LICENSE.md) for details.
