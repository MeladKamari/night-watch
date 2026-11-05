import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'

@Component({
  standalone: true,
  template: `<h2>{{ title }}</h2><p>Console module scaffold — STEP 100+.</p>`,
})
export class PlaceholderPage {
  title = 'Module'
  constructor(route: ActivatedRoute) {
    this.title = route.snapshot.routeConfig?.path ?? 'Module'
  }
}
