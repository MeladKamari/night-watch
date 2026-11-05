import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ConsoleApiService } from '../core/api.service'

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel login">
      <h1>ورود کنسول / Console login</h1>
      <p class="lede">Session + CSRF از سرور. پیش‌فرض lab: admin / admin-change-me</p>
      <form class="grid" (ngSubmit)="submit()">
        <label>Username <input name="user" [(ngModel)]="username" autocomplete="username" required /></label>
        <label>Password <input name="pass" type="password" [(ngModel)]="password" autocomplete="current-password" required /></label>
        <button type="submit" [disabled]="busy">Sign in</button>
      </form>
      @if (error) {
        <p class="err">{{ error }}</p>
      }
    </section>
  `,
  styleUrl: './pages.css',
  styles: [
    `
      .login {
        max-width: 420px;
      }
      .err {
        color: #b42318;
      }
    `,
  ],
})
export class LoginPage {
  private readonly api = inject(ConsoleApiService)
  private readonly router = inject(Router)
  username = 'admin'
  password = 'admin-change-me'
  busy = false
  error = ''

  async submit(): Promise<void> {
    this.busy = true
    this.error = ''
    try {
      if (!this.api.networkEnabled) {
        this.error = 'Network disabled — set window.NIGHT_WATCH_NETWORK=1'
        return
      }
      await this.api.login(this.username, this.password)
      await this.router.navigateByUrl('/dashboard')
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'login_failed'
    } finally {
      this.busy = false
    }
  }
}
