import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonCol, IonRow, IonButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AlertController } from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';




@Component({
  selector: 'app-start-menu',
  templateUrl: './start-menu.page.html',
  styleUrls: ['./start-menu.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonGrid, IonCol, IonRow, IonButton]
})
export class StartMenuPage implements OnInit {

  public user: any;
  // public host_url: string = 'http://localhost:3000';
  public host_url = 'https://ddback-1.onrender.com';
  private music = new Audio('assets/music/menu-song.mp3');
  private click = new Audio('assets/music/sound-sprites/click.mp3');
  private musicReady = false;
  private musicStarted = false;
  public isLogged = false;
  public started = false;
  constructor(@Inject(DOCUMENT) public document: Document, private auth: AuthService, private http: HttpClient, private router: Router, private alertController: AlertController,) { }

  ngOnInit() {
    this.auth.user$.subscribe((data) => {
      this.user = data;
      this.isLogged = !!data?.email; // <-- CLAVE
      console.log('Logged:', this.isLogged);

      if (!data?.email) return;

      const payload = {
        email: data.email,
        given_name: data.given_name,
        name: data.name
      };

      this.http.post(`${this.host_url}/users`, payload).subscribe({
        next: (res: any) => {
          console.log('User guardado:', res);
          localStorage.setItem('user', JSON.stringify(this.user));
        },
        error: (err) => console.error('Error guardando user:', err)
      });
    });
  }

  clickSound() {
    this.click.load();
    this.click.play();
  }


  startAdventure() {
    this.clickSound();
    this.started = true;
    this.music.play();
  }

  async movePage(page: string) { // Funcion para movernos a la pagina de juego
    this.clickSound();
    this.music.pause();
    console.log('Moving to page: ', page);
    this.router.navigate(['/' + page]);
  }

  login() {
    this.clickSound();
    this.auth.loginWithRedirect({
      appState: {
        target: '/start-menu',
      }
    });
  }

  logout() {
    this.clickSound();
    localStorage.removeItem('user');
    this.auth.logout({
      logoutParams: {
        returnTo: this.document.location.origin
      }
    });
  }

  goToInfo() {
    this.router.navigate(['/lore']);
  }

  goTavern() {
    this.router.navigate(['/tavern']);
  }

}
