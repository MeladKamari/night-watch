using NightWatch.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace NightWatch.Persistence;

public sealed class ProPlusDbContext(DbContextOptions<ProPlusDbContext> options) : DbContext(options)
{
    public Guid? CurrentTenantId { get; set; }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<EnvironmentEntity> Environments => Set<EnvironmentEntity>();
    public DbSet<OriginAllowlist> Origins => Set<OriginAllowlist>();
    public DbSet<ScopedApiKey> ApiKeys => Set<ScopedApiKey>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();
    public DbSet<ManagementApiKeyRow> ManagementApiKeys => Set<ManagementApiKeyRow>();
    public DbSet<ManagementWebhookSubscriptionRow> ManagementWebhookSubscriptions => Set<ManagementWebhookSubscriptionRow>();
    public DbSet<ManagementProjectRow> ManagementProjects => Set<ManagementProjectRow>();
    public DbSet<VisitorDeviceVectorRow> VisitorDeviceVectors => Set<VisitorDeviceVectorRow>();
    public DbSet<VisitorAliasIndexRow> VisitorAliasIndex => Set<VisitorAliasIndexRow>();

    public DbSet<Visitor> Visitors => Set<Visitor>();
    public DbSet<VisitorAlias> VisitorAliases => Set<VisitorAlias>();
    public DbSet<LinkedAccount> LinkedAccounts => Set<LinkedAccount>();
    public DbSet<IdentityEdge> IdentityEdges => Set<IdentityEdge>();
    public DbSet<IdentificationEvent> IdentificationEvents => Set<IdentificationEvent>();
    public DbSet<SignalObservation> SignalObservations => Set<SignalObservation>();
    public DbSet<EvidenceRecord> EvidenceRecords => Set<EvidenceRecord>();
    public DbSet<CollectorFailure> CollectorFailures => Set<CollectorFailure>();
    public DbSet<EventDecision> EventDecisions => Set<EventDecision>();

    public DbSet<PipelineBusinessEvent> PipelineEvents => Set<PipelineBusinessEvent>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxReceipt> InboxReceipts => Set<InboxReceipt>();
    public DbSet<DeadLetterMessage> DeadLetterMessages => Set<DeadLetterMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureTenancy(modelBuilder);
        ConfigureIdentityEvents(modelBuilder);
        ConfigurePipeline(modelBuilder);
    }

    private void ConfigureTenancy(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.Property(x => x.PublicId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasQueryFilter(x => x.DeletedAt == null);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.ToTable("projects");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
            e.Property(x => x.PublicId).HasMaxLength(64).IsRequired();
            e.HasOne(x => x.Tenant).WithMany(t => t.Projects).HasForeignKey(x => x.TenantId);
            e.HasQueryFilter(x => x.DeletedAt == null && (CurrentTenantId == null || x.TenantId == CurrentTenantId));
        });

        modelBuilder.Entity<EnvironmentEntity>(e =>
        {
            e.ToTable("environments");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ProjectId, x.CreatedAt });
            e.HasOne(x => x.Project).WithMany(p => p.Environments).HasForeignKey(x => x.ProjectId);
            e.HasQueryFilter(x => x.DeletedAt == null && (CurrentTenantId == null || x.TenantId == CurrentTenantId));
        });

        modelBuilder.Entity<OriginAllowlist>(e =>
        {
            e.ToTable("origins");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.EnvironmentId });
            e.Property(x => x.OriginPattern).HasMaxLength(256).IsRequired();
            e.HasOne(x => x.Environment).WithMany(env => env.Origins).HasForeignKey(x => x.EnvironmentId);
            e.HasQueryFilter(x => x.DeletedAt == null && (CurrentTenantId == null || x.TenantId == CurrentTenantId));
        });

        modelBuilder.Entity<ScopedApiKey>(e =>
        {
            e.ToTable("scoped_api_keys");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.KeyId }).IsUnique();
            e.Property(x => x.KeyKind).HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Environment).WithMany(env => env.ApiKeys).HasForeignKey(x => x.EnvironmentId);
            e.HasQueryFilter(x => x.DeletedAt == null && (CurrentTenantId == null || x.TenantId == CurrentTenantId));
        });

        modelBuilder.Entity<AuditLogEntry>(e =>
        {
            e.ToTable("audit_log");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<ManagementApiKeyRow>(e =>
        {
            e.ToTable("management_api_keys");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.KeyId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.EnvironmentId });
            e.Property(x => x.KeyId).HasMaxLength(64).IsRequired();
            e.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            e.Property(x => x.SecretHash).HasMaxLength(128).IsRequired();
        });

        modelBuilder.Entity<ManagementWebhookSubscriptionRow>(e =>
        {
            e.ToTable("management_webhook_subscriptions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SubscriptionId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.EnvironmentId });
            e.Property(x => x.SubscriptionId).HasMaxLength(64).IsRequired();
            e.Property(x => x.TargetUrl).HasMaxLength(512).IsRequired();
            e.Property(x => x.SigningSecret).HasMaxLength(128).IsRequired();
        });

        modelBuilder.Entity<ManagementProjectRow>(e =>
        {
            e.ToTable("management_projects");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.ProjectId }).IsUnique();
            e.Property(x => x.ProjectId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<VisitorDeviceVectorRow>(e =>
        {
            e.ToTable("visitor_device_vectors");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.VisitorId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Namespace, x.ObservedAt });
            e.HasIndex(x => new { x.TenantId, x.ContinuityId });
            e.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            e.Property(x => x.Namespace).HasMaxLength(256).IsRequired();
            e.Property(x => x.VisitorId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ContinuityId).HasMaxLength(64);
            e.Property(x => x.BlockKey).HasMaxLength(128);
            e.Property(x => x.VectorVersion).HasMaxLength(64).IsRequired();
        });

        modelBuilder.Entity<VisitorAliasIndexRow>(e =>
        {
            e.ToTable("visitor_alias_index");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Namespace, x.AliasKind, x.AliasValue }).IsUnique();
            e.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            e.Property(x => x.Namespace).HasMaxLength(256).IsRequired();
            e.Property(x => x.AliasKind).HasMaxLength(64).IsRequired();
            e.Property(x => x.AliasValue).HasMaxLength(128).IsRequired();
            e.Property(x => x.VisitorId).HasMaxLength(64).IsRequired();
        });
    }

    private void ConfigureIdentityEvents(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Visitor>(e =>
        {
            e.ToTable("visitors");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ProjectId, x.LastSeenAt });
            e.Property(x => x.PublicId).HasMaxLength(64).IsRequired();
            e.Property(x => x.IdentityAlgorithmVersion).HasMaxLength(64).IsRequired();
            e.HasQueryFilter(x => x.DeletedAt == null && (CurrentTenantId == null || x.TenantId == CurrentTenantId));
        });

        modelBuilder.Entity<VisitorAlias>(e =>
        {
            e.ToTable("visitor_aliases");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.AliasKind, x.AliasValue }).IsUnique();
            e.Property(x => x.AliasKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.AliasValue).HasMaxLength(128).IsRequired();
            e.HasOne(x => x.Visitor).WithMany(v => v.Aliases).HasForeignKey(x => x.VisitorId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<LinkedAccount>(e =>
        {
            e.ToTable("linked_accounts");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.SubjectKey });
            e.Property(x => x.SubjectKey).HasMaxLength(128).IsRequired();
            e.HasOne(x => x.Visitor).WithMany().HasForeignKey(x => x.VisitorId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<IdentityEdge>(e =>
        {
            e.ToTable("identity_edges");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.FromVisitorId, x.ToVisitorId, x.EdgeType });
            e.Property(x => x.EvidenceStatus).HasMaxLength(32).IsRequired();
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<IdentificationEvent>(e =>
        {
            e.ToTable("identification_events");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            // High-volume access path — partition plan documented for Postgres by (tenant_id, created_at).
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
            e.HasIndex(x => new { x.TenantId, x.VisitorId, x.CreatedAt });
            e.HasIndex(x => new { x.TenantId, x.RetainUntil });
            e.HasIndex(x => new { x.TenantId, x.IdempotencyKey });
            e.Property(x => x.PublicId).HasMaxLength(64).IsRequired();
            e.Property(x => x.LegacyBrowserVisitorId).HasMaxLength(32);
            e.Property(x => x.MatchType).HasMaxLength(32).IsRequired();
            e.Property(x => x.IdentityOutcome).HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Visitor).WithMany(v => v.Events).HasForeignKey(x => x.VisitorId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<SignalObservation>(e =>
        {
            e.ToTable("signal_observations");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.EventId, x.SignalId }).IsUnique();
            e.Property(x => x.SignalId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.Provenance).HasMaxLength(64).IsRequired();
            e.HasOne(x => x.Event).WithMany(ev => ev.Signals).HasForeignKey(x => x.EventId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<EvidenceRecord>(e =>
        {
            e.ToTable("evidence");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.EventId, x.ObservedAt });
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Event).WithMany(ev => ev.Evidence).HasForeignKey(x => x.EventId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<CollectorFailure>(e =>
        {
            e.ToTable("collector_failures");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.EventId });
            e.Property(x => x.SourceName).HasMaxLength(64).IsRequired();
            e.HasOne(x => x.Event).WithMany(ev => ev.CollectorFailures).HasForeignKey(x => x.EventId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<EventDecision>(e =>
        {
            e.ToTable("event_decisions");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.EventId }).IsUnique();
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.Decision).HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Event).WithOne(ev => ev.Decision).HasForeignKey<EventDecision>(x => x.EventId);
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });
    }

    private void ConfigurePipeline(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PipelineBusinessEvent>(e =>
        {
            e.ToTable("pipeline_events");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.PublicId).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
            e.Property(x => x.PublicId).HasMaxLength(64).IsRequired();
            e.Property(x => x.State).HasMaxLength(32).IsRequired();
            e.Property(x => x.EventVersion).HasMaxLength(64).IsRequired();
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<OutboxMessage>(e =>
        {
            e.ToTable("outbox_messages");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Status, x.NextAttemptAt });
            e.HasIndex(x => x.IdempotencyKey).IsUnique();
            e.Property(x => x.MessageType).HasMaxLength(32).IsRequired();
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.IdempotencyKey).HasMaxLength(128).IsRequired();
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<InboxReceipt>(e =>
        {
            e.ToTable("inbox_receipts");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.MessageKey }).IsUnique();
            e.Property(x => x.MessageKey).HasMaxLength(128).IsRequired();
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<DeadLetterMessage>(e =>
        {
            e.ToTable("dead_letter_messages");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.DeadAt });
            e.Property(x => x.Reason).HasMaxLength(256).IsRequired();
            e.HasQueryFilter(x => CurrentTenantId == null || x.TenantId == CurrentTenantId);
        });
    }
}
