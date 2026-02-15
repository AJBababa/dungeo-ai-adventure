import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet],
})
export class AppComponent {
  showLoader = false;

  private pending = 0;
  private startedAt = 0;
  private hideTimer: any = null;

  constructor(private router: Router) {
    
  }

  private onStart() {
    this.pending++;

    // cancel scheduled hide if a new navigation starts
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // first navigation in flight -> show loader now
    if (this.pending === 1) {
      this.startedAt = Date.now();
      this.showLoader = true;
    }
  }

  private onEnd() {
    this.pending = Math.max(0, this.pending - 1);

    // only hide when ALL navigations finished
    if (this.pending !== 0) return;

    const minMs = 2000; // ✅ force 2 seconds
    const elapsed = Date.now() - this.startedAt;
    const remaining = Math.max(0, minMs - elapsed);

    this.hideTimer = setTimeout(() => {
      this.showLoader = false;
      this.hideTimer = null;
    }, remaining);
  }
}

