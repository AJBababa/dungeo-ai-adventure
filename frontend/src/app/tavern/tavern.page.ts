import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonBadge, IonImg, AlertController
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';

@Component({
  selector: 'app-tavern',
  templateUrl: './tavern.page.html',
  styleUrls: ['./tavern.page.scss'],
  standalone: true,
  imports: [
    NgIf,
    IonImg, IonBadge, IonContent, IonHeader, IonTitle, IonToolbar,
    CommonModule, FormsModule, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle
  ]
})
export class TavernPage implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth0Service);
  private http = inject(HttpClient);
  private alertController = inject(AlertController);

  public characters: any[] = [];
  public selectedCompanionId: number | undefined;
  public currentCompanion: any = null;
  public host_url = 'https://ddback-1.onrender.com/';
  // public url_host = 'http://localhost:3000/';
  public mainUserEmail!: string;

  // ey 
  ngOnInit() {
    // Verificamos autenticación
    this.auth.isAuthenticated$.subscribe(isAuth => {
      if (!isAuth) this.router.navigate(['/login']);
    });

    // Obtenemos email del usuario
    this.auth.user$.subscribe(async (user: User | null | undefined) => {
      if (user?.email) {
        this.mainUserEmail = user.email;
        this.loadAllCharacters();
      } else {
        console.error('No hay usuario logueado o no tiene email');
        const alert = await this.alertController.create({
          header: 'Error',
          message: 'Error interno: usuario no identificado',
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();
      }
    });
  }

  // Cargamos todos los personajes
  loadAllCharacters() {
    this.http.get(`${this.host_url}characters`).subscribe({
      next: (resp: any) => {
        this.characters = resp.map((char: any) => ({ ...char, selected: false }));
        this.loadAssignedCompanion();
      },
      error: async (err) => {
        console.error('Error al obtener characters:', err);
        const alert = await this.alertController.create({
          header: 'Error',
          message: 'Error al cargar los personajes.',
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();
      }
    });
  }

  // Cargamos el compañero asignado del usuario
  loadAssignedCompanion() {
    if (!this.mainUserEmail) return;

    this.http.get(`${this.host_url}companero/${encodeURIComponent(this.mainUserEmail)}`)
      .subscribe({
        next: (resp: any) => {
          if (resp.companion_id) {
            const char = this.characters.find(c => c.id === resp.companion_id);
            if (char) {
              this.currentCompanion = char; // 🔹 objeto completo del personaje
              this.selectedCompanionId = char.id;

              // Marcamos como seleccionado en la lista
              this.characters = this.characters.map(c => ({
                ...c,
                selected: c.id === char.id
              }));
            }
          } else {
            this.currentCompanion = null;
            this.selectedCompanionId = undefined;
          }
        },
        error: (err) => console.error('Error al obtener compañero asignado:', err)
      });
  }

  // Asignar un compañero
  async selectCompanion(companion_id: number) {
    if (!this.mainUserEmail) {
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Error interno: usuario no definido',
        buttons: ['OK'],
        cssClass: 'pixel-alert',
        backdropDismiss: true,
      });
      await alert.present();
      return;
    }

    this.http.post(`${this.host_url}companero`, {
      id_user: this.mainUserEmail,
      companion_id
    }).subscribe({
      next: async () => {
        const char = this.characters.find(c => c.id === companion_id);
        if (char) this.currentCompanion = char; // 🔹 guardamos objeto completo
        this.selectedCompanionId = companion_id;

        this.characters = this.characters.map(c => ({
          ...c,
          selected: c.id === companion_id
        }));

        const alert = await this.alertController.create({
          header: 'Compañero asignado',
          message: '¡Compañero asignado correctamente!',
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();
      },
      error: async (err) => {
        console.error('Error asignando compañero:', err);
        let msg = 'Error asignando compañero.';
        if (err.status === 409) msg = 'Ya tienes un compañero asignado.';
        else if (err.status === 400) msg = 'IDs inválidos enviados al servidor.';

        const alert = await this.alertController.create({
          header: 'Error',
          message: msg,
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();
      }
    });
  }

  // Eliminar compañero
  removeCompanion() {
    if (!this.mainUserEmail) return;

    const userEmail = encodeURIComponent(this.mainUserEmail);

    this.http.delete(`${this.host_url}companero/${userEmail}`).subscribe({
      next: async () => {
        const alert = await this.alertController.create({
          header: 'Compañero eliminado',
          message: 'Compañero eliminado correctamente.',
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();

        this.currentCompanion = null;
        this.selectedCompanionId = undefined;

        this.characters = this.characters.map(c => ({ ...c, selected: false }));
      },
      error: async (err) => {
        console.error('Error eliminando compañero:', err);
        let msg = 'Error eliminando compañero.';
        if (err.status === 404) msg = 'No se encontró compañero para eliminar.';

        const alert = await this.alertController.create({
          header: 'Error',
          message: msg,
          buttons: ['OK'],
          cssClass: 'pixel-alert',
          backdropDismiss: true,
        });
        await alert.present();
      }
    });
  }

  // Volver al menú principal
  goBack() {
    this.router.navigate(['/start-menu']);
  }

}
