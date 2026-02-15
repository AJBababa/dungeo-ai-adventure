import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import { provideAuth0 } from '@auth0/auth0-angular';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({animated: false}),
    provideHttpClient(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideAuth0({
      domain: 'dev-rf6kcs3z3otn50pc.us.auth0.com',
      clientId: 'wKmB9G8MfGAJaLduwelXwF9FN57Ev6om',
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    }),
  ],
});
