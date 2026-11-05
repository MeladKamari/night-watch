import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConsoleScreenModels, type TenantEnvConfig } from '../core/screen-models'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <h1>پیکربندی مستأجر / Tenant &amp; environment</h1>
      <p class="lede">Source: <code>{{ source }}</code> — بدون تصمیم ریسک در فرانت‌اند.</p>
      <form class="grid" (ngSubmit)="save()">
        <label>Tenant ID<input [(ngModel)]="model.tenantId" name="tenantId" required /></label>
        <label>Project name<input [(ngModel)]="projectName" name="projectName" required /></label>
        <label
          >Environment
          <select [(ngModel)]="model.environment" name="environment">
            <option value="dev">dev</option>
            <option value="stage">stage</option>
            <option value="prod">prod</option>
          </select>
        </label>
        <label>Retention (days)<input type="number" [(ngModel)]="model.retentionDays" name="retention" min="1" /></label>
        <button type="submit">{{ selectedProjectId ? 'Patch project' : 'Create project' }}</button>
      </form>
      @if (message) {
        <p class="ok">{{ message }}</p>
      }
      <ul>
        @for (p of projects; track p.projectId) {
          <li>
            <button type="button" (click)="select(p.projectId, p.name, p.retentionDays, p.revision)">
              {{ p.name }} <code>{{ p.projectId }}</code> rev={{ p.revision }}
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrl: './pages.css',
})
export class TenantConfigPage implements OnInit {
  private readonly api = inject(ConsoleApiService)
  private readonly screens = new ConsoleScreenModels()
  model: TenantEnvConfig = this.screens.tenantConfig()
  projectName = 'Console project'
  selectedProjectId = ''
  revision = 1
  message = ''
  source: 'api' | 'demo-fallback' = 'demo-fallback'
  projects: { projectId: string; name: string; retentionDays: number; revision: number }[] = []

  async ngOnInit(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    const items = await this.api.projects()
    if (!items) {
      this.source = 'demo-fallback'
      this.projects = []
      return
    }
    this.source = 'api'
    this.projects = items.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      retentionDays: p.retentionDays,
      revision: p.revision,
    }))
  }

  select(projectId: string, name: string, retentionDays: number, revision: number): void {
    this.selectedProjectId = projectId
    this.projectName = name
    this.model.retentionDays = retentionDays
    this.revision = revision
    this.model.projectId = projectId
  }

  async save(): Promise<void> {
    if (!this.api.networkEnabled) {
      this.message = 'Saved locally (demo). Enable NIGHT_WATCH_NETWORK=1 for API.'
      this.source = 'demo-fallback'
      return
    }
    if (this.selectedProjectId) {
      const patched = await this.api.patchProject(this.selectedProjectId, {
        name: this.projectName,
        retentionDays: this.model.retentionDays,
        ifMatchRevision: this.revision,
      })
      this.message = patched ? `Patched ${patched.projectId} rev=${patched.revision}` : 'Patch failed'
    } else {
      const created = await this.api.createProject(this.projectName)
      this.message = created ? `Created ${created.projectId}` : 'Create failed'
      if (created) {
        this.selectedProjectId = created.projectId
        this.revision = created.revision
        this.model.projectId = created.projectId
      }
    }
    await this.reload()
  }
}
