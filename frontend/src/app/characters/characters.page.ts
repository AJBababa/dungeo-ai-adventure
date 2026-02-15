import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonGrid, IonRow, IonCol, IonButton, IonInput, IonTextarea, IonRange, IonIcon, IonSelectOption, IonSelect
} from '@ionic/angular/standalone';
import { add } from 'ionicons/icons';
import { AlertController } from '@ionic/angular/standalone';
import { ChangeDetectorRef } from '@angular/core';

export interface Character {
  id: number;
  name: string;
  description: string;
  health: number;
  strength: number;
  agility: number;
  luck: number;
  level: number;
  experience: number;
  coin: number;
  is_alive: boolean;
  user_id: number;
}
type AvatarResponse = {
  image: string; // dataURL -> "data:image/png;base64,...."
};


@Component({
  selector: 'app-characters',
  templateUrl: './characters.page.html',
  styleUrls: ['./characters.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonGrid, IonRow, IonCol, IonButton, IonInput, IonTextarea, IonRange, IonIcon, IonSelectOption, IonSelect
  ]
})

export class CharactersPage {


  public race: string = '';
  public races: string[] = ['Humano', 'Elfo', 'Enano', 'Orco', 'No-muerto', 'Reptiliano', 'Vampiro'];

  public avatarImage: string | null = null;
  public generatingAvatar = false;
  public avatarGenerated = false;

  // public url_host = 'http://localhost:3000/';
  public url_host = 'https://ddback-1.onrender.com/';

  private click = new Audio('assets/music/sound-sprites/click.mp3');
  private musicReady = false;
  // Vista: false = “tarjeta +”, true = formulario
  public creating = false;
  public avatarBase64: string | null = null;

  // Form
  public name = '';
  public description = '';

  public remainingPoints = 0; // Esto son los puntos restantes para añadir a las stats

  public health = 100;
  public strenght = 100;
  public agility = 100;
  public luck = 100;

  public characters: any[] = [];
  public user: any;
  public selectedCharacter: any = null;
  public registros: any
  public editing_char: boolean = false;
  public idchar: any;

  constructor(private http: HttpClient, private alertController: AlertController,) {
    // Registrar icono
    (IonIcon as any).addIcons?.({ add });
  }

  ngOnInit() {
    // Hay que cargar todos los personbajes del usuario

    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
      throw new Error('User not found in localStorage');
    }
    this.user = JSON.parse(userRaw);
    this.loadCharacters();
    this.remainingPoints = 20

  }

  clickSound() {
    this.click.load();
    this.click.play();
  }


  // generar el avatar con la descripción (antiguo)
  public async generateAvatarFromDescription(description?: string) {
    this.clickSound();
    const desc = (description ?? this.description ?? '').trim();

    if (!desc) {
      const alert = await this.alertController.create({
        header: 'Sin descripción',
        message: 'Escribe una descripción del personaje para generar el avatar.',
        buttons: ['OK'],
        cssClass: 'pixel-alert',
        backdropDismiss: true,
      });
      await alert.present();
      return;
    }

    this.generatingAvatar = true;

    this.http
      .post<AvatarResponse>(this.url_host + 'gemini/avatar', { description: desc })
      .subscribe({
        next: async (resp) => {
          this.avatarImage = resp?.image ?? null;
          this.avatarBase64 = this.avatarImage; // ✅ si quieres guardarlo también aquí
          this.generatingAvatar = false;
        },
        error: async (err) => {
          console.error('Error generando avatar:', err);
          this.generatingAvatar = false;

          const alert = await this.alertController.create({
            header: 'Error',
            message: 'No se pudo generar el avatar.',
            buttons: ['OK'],
            cssClass: 'pixel-alert',
            backdropDismiss: true,
          });
          await alert.present();
        },
      });
  }

  // generar avatar con la raza (nueco)
  public async generateAvatarFromRace() {
    if (this.avatarGenerated || this.avatarImage) return;
    const race = (this.race ?? '').trim();
    if (!race) {
      const alert = await this.alertController.create({
        header: 'Selecciona una raza',
        message: 'Elige una raza para generar el avatar.',
        buttons: ['OK'],
        cssClass: 'pixel-alert',
        backdropDismiss: true,
      });
      await alert.present();
      return;
    }

    this.generatingAvatar = true;

    const prompt = `Raza: ${race}`;

    this.http
      .post<AvatarResponse>(this.url_host + 'gemini/avatar', { description: prompt, raza: race })
      .subscribe({
        next: async (resp) => {
          this.avatarImage = resp?.image ?? null;
          this.avatarBase64 = this.avatarImage;
          this.generatingAvatar = false;
        },
        error: async (err) => {
          console.error('Error generando avatar:', err);
          this.generatingAvatar = false;

          const alert = await this.alertController.create({
            header: 'Error',
            message: 'No se pudo generar el avatar.',
            buttons: ['OK'],
            cssClass: 'pixel-alert',
            backdropDismiss: true,
          });
          await alert.present();
        },
      });
  }



  loadCharacters() {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
      console.error('User not found in localStorage');
      return;
    }

    this.user = JSON.parse(userRaw);

    const userId = this.user.email; // <-- email

    this.http.get(this.url_host + 'users/' + encodeURIComponent(userId) + '/load_characters').subscribe({
      next: (resp: any) => {
        console.log('Characters received:', resp);
        this.characters = resp;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  selectCharacter(character: any) {
    localStorage.removeItem('id_char');
    console.log('Character selected:', character);
    this.selectedCharacter = character;
    localStorage.setItem('id_char', JSON.stringify(character.id));
  }


  async maxCharacters() {
    const alert = await this.alertController.create({
      header: 'Máximo de personajes',
      subHeader: 'El máximo de personajes que puedes tener es de 5',
      cssClass: 'maxCharacters',
      buttons: [
        { text: 'OK' },
      ]
    });
    await alert.present();
  }

  /* alerta d descripción
  private async showCreateInfoPopup() {
    const alert = await this.alertController.create({
      header: 'GENERACIÓN DE AVATAR',
      message: '\nLA IMAGEN SE GENERA SEGÚN TU DESCRIPCIÓN.\nCUANTO MÁS DETALLE, MEJOR.\n\nRECUERDA AÑADIR ALTURA, COLORES Y ESTILO PROPIO.',

      buttons: [{ text: 'OK', cssClass: 'alert-button' }],
      cssClass: 'pixel-alert',
      backdropDismiss: false,
    });

    await alert.present();
  }
  */

  openCreate() {
    this.clickSound();
    if (this.characters.length >= 5) {
      this.maxCharacters();
      return;
    }
    this.creating = true;
    //this.showCreateInfoPopup();
  }

  cancelCreate() {
    this.clickSound()
    this.registros = []
    this.creating = false;
    this.remainingPoints = 20
    this.resetForm();
  }

  // botón para subir bajar stats con el
  increase(stat: 'health' | 'strenght' | 'agility' | 'luck') {
    this.clickSound()
    if (this.remainingPoints <= 0) return;

    if (stat === 'health' && this.health < 200) this.health++;
    if (stat === 'strenght' && this.strenght < 200) this.strenght++;
    if (stat === 'agility' && this.agility < 200) this.agility++;
    if (stat === 'luck' && this.luck < 200) this.luck++;

    this.remainingPoints--;
  }
  decrease(stat: 'health' | 'strenght' | 'agility' | 'luck') {
    this.clickSound()
    if (stat === 'health' && this.health > 10) this.health--;
    else if (stat === 'strenght' && this.strenght > 10) this.strenght--;
    else if (stat === 'agility' && this.agility > 10) this.agility--;
    else if (stat === 'luck' && this.luck > 0) this.luck--;
    else return;

    this.remainingPoints++;
  }

  resetForm() {
    this.name = '';
    this.race = '';
    this.description = '';
    this.health = 100;
    this.strenght = 100;
    this.agility = 100;
    this.luck = 100;
    this.avatarImage = null;
    this.avatarBase64 = null;
    this.avatarGenerated = false;
  }


  saveCharacter() {

    const body = {
      id: this.idchar,
      name: this.name,
      race: this.race,
      description: this.description,
      health: this.health,
      strenght: this.strenght,
      agility: this.agility,
      luck: this.luck,
      user_id: this.user.email, // email como user_id
      is_alive: true,
      coin: 0,
      level: 1,
      experience: 0,
      puntos_disponibles: this.remainingPoints,
      svg: this.avatarBase64 ?? this.avatarImage
    };

    if (this.editing_char === true) { // Para editar el personaje y no crear uno nuevo

      this.http.post(this.url_host + 'save_character', body).subscribe({
        next: async (resp: any) => {
          console.log('Character saved:', resp);

          const alert = await this.alertController.create({
            header: 'Personaje guardado',
            message: `Se ha guardado el personaje "${this.name}" correctamente.`,
            buttons: ['OK'],
            backdropDismiss: true,
            cssClass: 'pixel-alert'
          });

          await alert.present();

          this.creating = false;
          this.resetForm();
          this.loadCharacters(); // recarga la lista
          this.remainingPoints = 20;
        },

        error: (err) => {
          console.error(err);
        }
      });
    } else {
      this.http.post(this.url_host + 'create_character', body).subscribe({
        next: async (resp: any) => {
          console.log('Character created:', resp);

          const alert = await this.alertController.create({
            header: 'Personaje creado',
            message: `Se ha creado el personaje "${this.name}".`,
            buttons: ['OK'],
            backdropDismiss: true,
            cssClass: 'pixel-alert'
          });

          await alert.present();

          this.creating = false;
          this.resetForm();
          this.loadCharacters(); // recarga la lista
        },

        error: (err) => {
          console.error(err);
        }
      });
    }
    this.remainingPoints = 20
  }

  goBack() {
    this.clickSound()
    if (this.creating) {
      // Si está en el formulario, vuelve al listado
      this.creating = false;
    } else {
      // Si ya está en el listado, vuelve atrás (o navega a otra página)
      // opción A: historial
      window.history.back();

      // opción B (recomendada si usas router):
      // this.router.navigate(['/menu']);
    }
  }

  deleteCharacter(characterId: number) {
    this.clickSound()
    this.http.delete(
      this.url_host + 'characters/' + characterId
    ).subscribe({
      next: (resp) => {
        console.log('Character deleted:', resp);
        // quitarlo del array en memoria
        this.characters = this.characters.filter(c => c.id !== characterId);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  configureCharacter(char: any) {
    this.clickSound()
    console.log('personaje' + JSON.stringify(char))
    this.idchar = char.id
    this.creating = true
    this.editing_char = true
    this.name = char.name
    this.race = char.raza
    this.description = char.description
    this.remainingPoints = char.puntos_disponibles
    this.health = char.health
    this.agility = char.agility
    this.strenght = char.strenght
    this.luck = char.luck
    this.loadRegistros(char.id);
    this.avatarImage = char.svg ?? null;
    this.avatarBase64 = this.avatarImage;
  }

  loadRegistros(charid: any) {


    this.http.get(this.url_host + 'users/' + charid + '/' + 'registros').subscribe({
      next: async (resp: any) => {
        console.log('Registros cargados:', resp);

        this.registros = resp; // guarda el array en la página
      },
      error: (err) => {
        console.error(err);
      }
    });

  }
}
