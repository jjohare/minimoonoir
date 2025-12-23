<script lang="ts">
  import { base } from '$app/paths';
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <a href="{base}/admin/stats" class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
    <div class="card-body">
      <h2 class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Statistics
      </h2>
      <p class="text-sm text-base-content/70">View detailed system analytics and reports</p>
    </div>
  </a>

  <a href="{base}/admin/calendar" class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
    <div class="card-body">
      <h2 class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Calendar Events
      </h2>
      <p class="text-sm text-base-content/70">Manage NIP-52 calendar events and scheduling</p>
    </div>
  </a>
</div>
