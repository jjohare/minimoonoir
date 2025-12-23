<script lang="ts">
  export let stats: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    pendingApprovals: number;
  };
</script>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
  <div class="card bg-base-200">
    <div class="card-body items-center text-center">
      <div class="stat-value text-primary">{stats.totalUsers}</div>
      <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Users</div>
    </div>
  </div>

  <div class="card bg-base-200">
    <div class="card-body items-center text-center">
      <div class="stat-value text-primary">{stats.totalChannels}</div>
      <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Channels</div>
    </div>
  </div>

  <div class="card bg-base-200">
    <div class="card-body items-center text-center">
      <div class="stat-value text-primary">{stats.totalMessages}</div>
      <div class="text-sm text-base-content/70 uppercase tracking-wide">Total Messages</div>
    </div>
  </div>

  <div class="card bg-warning/20 border border-warning">
    <div class="card-body items-center text-center">
      <div class="stat-value text-warning">{stats.pendingApprovals}</div>
      <div class="text-sm text-base-content/70 uppercase tracking-wide">Pending Approvals</div>
    </div>
  </div>
</div>
