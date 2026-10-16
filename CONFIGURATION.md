### [0.1.0]
Configuration keys
* NoOfUsersToProcessMembershipJob - Specifies the number of users that will be processed by the user membership update job. The job will stop after the value is reached.
* UpdateAllTags - If set to true all the tags are checked and corrected. If set to false or missing only tags related to group inconsistencies are applied.
* UserRemovalLastSignInDateTime - Users with no activity after this date can be removed by the user removal job
* RemoveNonSignedInUserNoOfDays - Number of days after which users that have not finalized the sign in process can be remove by user removal job
* Reportnet2DataflowPublicUrl - base URL for dataflow that opens from the list.
* Reportnet3DataflowUrl - base URL for loading Reportnet3 dataflows (should not include query parameters)
* ReportnetFlowsListId - id of the sharepoint list the will contain the dataflows
* ArchiveLoggingListId - id of the sharepoint list the logging cleanup job moves the expired records to (the ArchiveLogging list). A record is copied there first and only removed from the Logging list once the copy succeeded, so nothing is lost if the archiving call fails. The key is mandatory: without it the job stops immediately and logs a High priority error, without deleting anything. The archive list must have the same columns as the Logging list (Title, ApplicationName, ApiPath, ApiData, Logtype, Priority, Timestamp, Action, AffectedUser); only these are carried over, the SharePoint system columns (id, Created, Modified, Author) are recreated by the archive list itself.
* LoggingDisabledInfoJobs - Comma-separated list of job names whose Info-level logs are NOT written to the Logging list (console output is unaffected). Valid names: MeetingFields, UserRemoval, UserSignInNames, OrganisationFields, Reportnet3Flows, AttendanceConsultations, LoggingCleanup, Eionet2-Azure-Jobs.
* LoggingDisabledWarningJobs - Same as LoggingDisabledInfoJobs but for Warning-level logs.
* LoggingDisabledErrorJobs - Same as above but for Error-level logs. Use sparingly — silencing errors hides genuine failures.

Events list columns
* GraphMeetingId (single line of text) - Stores the internal Microsoft Graph meeting id resolved from the meeting join code. It is written by the meeting attendance job (UpdateMeetingParticipants) the first time a meeting is processed. Microsoft only exposes the join-code → meeting-id lookup for 60 days after a meeting; storing the id keeps it available afterwards. The column must exist on the Events list, otherwise the save is skipped (logged to the console, not raised as an alert).

  Note: adding a column is a structural change to the list. After adding it, re-check that the columns the jobs filter on (Meetingstart, Meetingend, Processed) still have their indices — SharePoint can drop list indices on structural changes, which makes the filtered Graph queries fail (HonorNonIndexedQueriesWarningMayFailRandomly).