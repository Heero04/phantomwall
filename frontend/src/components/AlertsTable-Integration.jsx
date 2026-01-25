/**
 * Simple integration guide for AlertsTable component
 * 
 * To add the AlertsTable to your dashboard:
 * 
 * 1. Import the component at the top of your Dashboard.jsx:
 *    import AlertsTable from './components/AlertsTable'
 * 
 * 2. Add the component anywhere in your JSX where you want it to appear:
 *    <AlertsTable />
 * 
 * The component is completely self-contained and handles:
 * - Data fetching (currently mock data)
 * - Filtering by severity, time range, source IP, and category
 * - Auto-refresh every 30 seconds
 * - Responsive design
 * - Error handling
 */

// Example integration in Dashboard.jsx:

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* Your existing dashboard content */}
      
      {/* Add alerts table anywhere you want */}
      <AlertsTable />
      
      {/* Rest of your dashboard content */}
    </div>
  )
}

// The AlertsTable component provides:
// - Real-time alerts display with severity color coding
// - Filtering by: severity (Critical/High/Medium/Low), time range (15m to 7d), source IP, category
// - Sortable table with timestamp, severity, IPs, alert signature, category, action
// - Auto-refresh every 30 seconds
// - Mobile responsive design
// - Loading states and error handling

// Next steps to connect real data:
// 1. Replace the mock data in AlertsTable.jsx with actual API calls
// 2. Update the fetchAlerts() function to call your backend
// 3. Configure the API endpoint to query your DynamoDB alerts table
// 4. Optionally add WebSocket for real-time updates instead of polling