import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonButton,
  IonBackdrop,
  IonCol
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular/standalone';
import { ViewChild } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';

type TurnUI = {
  narrativa: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  showOptions: boolean;
};

type GameResponse = {
  vida: number;
  fuerza: number;
  agilidad: number;
  suerte: number;
  alive: boolean;
  run: number;
  narrativa: string;
  opcionA: string | null;
  opcionB: string | null;
  opcionC: string | null;
  game_ended: boolean; // ← Nuevo flag
};

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonGrid,
    IonRow,
    IonButton,
    IonBackdrop,
    IonCol
  ],
})
export class GamePage implements OnInit {
  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef,
    public router: Router

  ) { }
  @ViewChild(IonContent) content!: IonContent;
  // public url_host = 'http://localhost:3000/';
  public url_host = 'https://ddback-1.onrender.com/';
  public response: TurnUI[] = [];
  private currentMusic?: HTMLAudioElement;
  private typeSfx?: HTMLAudioElement;
  private lastTypeSfxAt = 0;
  private typeSfxCooldownMs = 35;
  private click = new Audio('assets/music/sound-sprites/click.mp3');
  public playerStats = {
    player_id: '',
    descripcion: '',
    vida: 100,
    fuerza: 100,
    agilidad: 100,
    suerte: 100,
    alive: true,
    run: 0,
    opcionA: '',
    opcionB: '',
    opcionC: '',
  };
  public disable_option_buttons = true;
  public finalBossDead = false;
  public character_id = '';
  private typingTimer: any = null;
  public typing = false;
  public gameCharacter: any = null;
  public loading = false;
  public character_choosen = false;
  public characters: any[] = [];
  public game_ended: boolean = false;
  public currentBackground: string = './../../assets/backgrounds/darkhollow.png';
  public game_won: boolean = false;

  public gridBgStyle: { [key: string]: string } = {
    'background-image': `url('assets/backgrounds/reino_lumnaris.png')`,
  };


  async ngOnInit() {

    this.http
      .get(this.url_host + 'clearHistory')
      .subscribe((resp: any) => {

      });

    this.game_ended = false
    this.disable_option_buttons = false

    const email =
      (() => {
        const raw = localStorage.getItem('user');
        if (!raw) return '';
        try { return JSON.parse(raw)?.email ?? ''; }
        catch { return ''; }
      })();

    //  Usabamos esto antes await this.loadCharacter(Number(this.character_id));
    await this.loadCharacters(email || '');

  }

  clickSound() {
    this.click.load();
    this.click.play();
  }

  loadCharacters(userEmail: string) {
    console.log('Cargando personajes para el usuario:', userEmail);
    this.http.get(this.url_host + 'users/' + userEmail + '/load_characters').subscribe({
      next: (resp: any) => {
        console.log('Characters received:', resp);
        this.characters = resp;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  private setGridBackground(src: string) {
    this.gridBgStyle = {
      'background-image': `url('${src}')`,
    };
  }


  loadCharacter(characterId: number) {
    if (!characterId || Number.isNaN(Number(characterId))) return;

    this.http
      .get(this.url_host + 'load_game_character/' + characterId)
      .subscribe((resp: any) => {
        this.gameCharacter = resp;

        this.playerStats.player_id = resp.user_id;
        this.playerStats.descripcion = resp.description;
        this.playerStats.vida = Number(resp.health);
        this.playerStats.fuerza = Number(resp.strenght);
        this.playerStats.agilidad = Number(resp.agility);
        this.playerStats.suerte = Number(resp.luck);
        this.playerStats.alive = resp.is_alive === true;
      });

  }

  async startGameAlert(character_id: any) {
    this.loading = true;
    const alert = await this.alertController.create({
      header: 'Empezar game',
      message: '¿Quieres comenzar la aventura con este personaje?',
      cssClass: 'pixel-alert',
      buttons: [
        { text: 'Volver', role: 'cancel', handler: () => window.history.back() },
        { text: 'Empezar', handler: () => this.startGame(character_id) },
      ],
      backdropDismiss: false,
    });

    await alert.present();
  }

  startGame(character_id: any) {
    this.primeAudio();
    this.recievePrompt(character_id);
  }

  recievePrompt(character_id: any) {
    this.loading = true;
    this.http
      .get<GameResponse>(this.url_host + 'gemini/' + character_id)
      .subscribe((resp) => {
        this.finalBossDead = resp.game_ended;

        const turn: TurnUI = {
          narrativa: '',
          opcionA: resp.opcionA ?? '',
          opcionB: resp.opcionB ?? '',
          opcionC: resp.opcionC ?? '',
          showOptions: false,
        };

        this.response.push(turn);
        const idx = this.response.length - 1;

        const texto = resp.narrativa ?? '';
        this.checkBackground();
        this.checkMusic();
        this.typeNarrativeThenShowOptions(texto, idx, 55);
      });
  }

  sendPromptResponse(letterOption: string) {
    this.clickSound();
    this.loading = true;
    this.disable_option_buttons = true;
    if (this.typing || !this.playerStats.alive) return;

    this.primeAudio();



    this.http
      .get<GameResponse>(this.url_host + 'geminiresponse/' + letterOption)
      .subscribe((resp) => {
        this.playerStats.vida = resp.vida;
        this.playerStats.fuerza = resp.fuerza;
        this.playerStats.agilidad = resp.agilidad;
        this.playerStats.suerte = resp.suerte;
        this.playerStats.run = resp.run;
        this.playerStats.alive = resp.alive;

        this.playerStats.opcionA = resp.opcionA ?? '';
        this.playerStats.opcionB = resp.opcionB ?? '';
        this.playerStats.opcionC = resp.opcionC ?? '';

        this.finalBossDead = resp.game_ended; // ← Actualizamos flag del boss

        if (!this.playerStats.alive) {
          this.game_ended = true
        }

        if (this.finalBossDead === true) {
          this.winFunction();
          this.disable_option_buttons = true
          this.game_ended = true
          this.game_won = true
        }

        const turn: TurnUI = {
          narrativa: '',
          opcionA: resp.opcionA ?? '',
          opcionB: resp.opcionB ?? '',
          opcionC: resp.opcionC ?? '',
          showOptions: false,
        };

        this.response.push(turn);
        const idx = this.response.length - 1;

        const texto = resp.narrativa ?? '';
        this.checkMusic();
        this.checkBackground();
        this.typeNarrativeThenShowOptions(texto, idx, 55);
      });
  }

  public winFunction() {
    this.http
      .get<GameResponse>(this.url_host + `win/${this.character_id}`)
      .subscribe((resp) => {
        console.log('Victoria...')
      });
  }
  public checkBackground() {
    this.http.get<{ background: string }>(this.url_host + 'background').subscribe({
      next: (resp) => {
        const raw = (resp?.background || '').trim();
        console.log('Respuesta /background (raw):', raw);

        // Normaliza: minúsculas + sin acentos + espacios limpios
        const norm = (s: string) =>
          s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[“”"']/g, '')     // quita comillas típicas
            .replace(/\s+/g, ' ')
            .trim();

        // Lista CANON: nombres exactos que esperas (sin separar los paréntesis)
        const canonicalPlaces: string[] = [
          'Reino de Lumnaris (La Corona Dorada)',
          'Reino de Umbraeth (La Corona de Hierro)',
          'Castillo Solarion',
          'Elenor (Capital Lumnaris)',
          'Torres de Cristal de Eldoria',
          'Puerto Mirith y Faro de Astrae',
          'Bosque Verdalis (Sylwind)',
          'Fortaleza Umbraxis',
          'Kar-Dur (Ciudad Forja)',
          'Páramos de Malakar y Las Forjas Ardientes',
          'Pantanos de Vhaelor (La Bruma Larga)',
          'Darkhollow (Bosque Negro)',
          'Paso de las Sombras (Frontera)',
          'Ruinas de Asterion (Prohibidas)',
          'Taberna La Estrella Rota',
          'Taberna El Caldero Negro',
          'Taberna El Último Refugio',
          'Taberna La Luz Bajo la Ceniza',
        ];

        // Mapa: lugar -> imagen (ajusta rutas/extensiones a tu proyecto)
        const backgrounds: Record<string, string> = {
          'Reino de Lumnaris (La Corona Dorada)': './../../assets/backgrounds/reino_lumnaris.png',
          'Reino de Umbraeth (La Corona de Hierro)': './../../assets/backgrounds/reino_umbraeth.png',

          'Castillo Solarion': './../../assets/backgrounds/castillo_solarion.png',
          'Elenor (Capital Lumnaris)': './../../assets/backgrounds/elenor.png',
          'Torres de Cristal de Eldoria': './../../assets/backgrounds/torres_cristal.png',
          'Puerto Mirith y Faro de Astrae': './../../assets/backgrounds/puerto_mirith.png',
          'Bosque Verdalis (Sylwind)': './../../assets/backgrounds/bosque_verdalis.png',

          'Fortaleza Umbraxis': './../../assets/backgrounds/fortaleza_umbraxis.png',
          'Kar-Dur (Ciudad Forja)': './../../assets/backgrounds/kar_dur.png',

          'Páramos de Malakar y Las Forjas Ardientes': './../../assets/backgrounds/forjas_ardientes_paramos_malakar.png',

          'Pantanos de Vhaelor (La Bruma Larga)': './../../assets/backgrounds/pantanos_vhaelor.png',
          'Darkhollow (Bosque Negro)': './../../assets/backgrounds/darkhollow.png',
          'Paso de las Sombras (Frontera)': './../../assets/backgrounds/paso_sombras.png',
          'Ruinas de Asterion (Prohibidas)': './../../assets/backgrounds/ruinas_asterion.png',

          'Taberna La Estrella Rota': './../../assets/backgrounds/taberna_estrella_rota.png',
          'Taberna El Caldero Negro': './../../assets/backgrounds/taberna_caldero.png',
          'Taberna El Último Refugio': './../../assets/backgrounds/taberna_refugio.png',
          'Taberna La Luz Bajo la Ceniza': './../../assets/backgrounds/taberna_luz.png',
        };


        const fallbackPlace = 'Darkhollow';
        const fallbackSrc = backgrounds[fallbackPlace];

        // 1) Si la IA devuelve el bloque con "NAME: X", extraemos X
        //    Ej: "NAME: Elenor (Capital Lumnaris)\nDESCRIPTION: ..."
        const nameMatch = raw.match(/NAME:\s*([^\n\r]+)/i);
        const candidateFromName = nameMatch?.[1]?.trim() || '';

        // 2) Intento principal: match exacto (normalizado)
        const pickByExact = (candidate: string) => {
          const cN = norm(candidate);
          for (const place of canonicalPlaces) {
            if (norm(place) === cN) return place;
          }
          return '';
        };

        // 3) Intento secundario: contiene (si devuelve "Elenor" o mete texto extra)
        const pickByContains = (text: string) => {
          const tN = norm(text);
          for (const place of canonicalPlaces) {
            const pN = norm(place);
            if (tN.includes(pN) || pN.includes(tN)) return place;
          }
          return '';
        };

        let chosenPlace =
          pickByExact(candidateFromName) ||
          pickByExact(raw) ||
          pickByContains(candidateFromName) ||
          pickByContains(raw) ||
          '';

        // 4) Si aun así no, fallback
        if (!chosenPlace) {
          console.warn('No se pudo resolver el lugar devuelto por IA. Usando fallback.');
          chosenPlace = fallbackPlace;
        }

        const src = backgrounds[chosenPlace];

        console.log('Lugar resuelto:', chosenPlace);
        console.log('Fondo resuelto:', src);

        // Guarda para tu UI (o úsalo donde quieras)
        this.currentBackground = src;

        // Si quieres aplicarlo directo (opcional):
        this.setGridBackground(src);
        // document.body.style.backgroundSize = 'cover';
        // document.body.style.backgroundPosition = 'center';
        // document.body.style.backgroundRepeat = 'no-repeat';
      },
      error: (err) => {
        console.error('Error llamando /background:', err);
      },
    });
  }

  public checkMusic() {
    this.http.get<{ music: string }>(this.url_host + 'music').subscribe({
      next: (resp) => {
        const choice = (resp?.music || '').trim();
        console.log('Musica elegida:', choice);

        const tracks: Record<string, string> = {
          Calmado: 'assets/music/calmado.mp3',
          Taberna: 'assets/music/taberna.mp3',
          Combate: 'assets/music/combate.mp3',
          Misterio: 'assets/music/misterio.mp3',
        };

        const src = tracks[choice] ?? tracks['Calmado'];

        if (this.currentMusic) {
          this.currentMusic.pause();
          this.currentMusic.currentTime = 0;
        }

        this.currentMusic = new Audio(src);
        this.currentMusic.loop = true;
        this.currentMusic.volume = 0.6;

        this.currentMusic.play().catch((err) =>
          console.warn('Reproducción bloqueada por el navegador:', err)
        );
      },
      error: (err) => {
        console.error('Error llamando /music:', err);
      },
    });
  }

  public changeVar() {
    this.clickSound();
    this.game_won = !this.game_won
    this.disable_option_buttons = true
  }

  public chooseCharacter(character_id: any) {
    this.clickSound();
    this.character_choosen = true;
    this.character_id = character_id
    this.startGameAlert(character_id);
  }


  private initTypeSfx() {
    if (this.typeSfx) return;

    this.typeSfx = new Audio('assets/music/sound-sprites/type-sound.mp3');
    this.typeSfx.volume = 0.22;
    this.typeSfx.preload = 'auto';
  }

  private playTypeSfx(charJustTyped: string) {
    if (!this.typeSfx) return;

    if (!charJustTyped || charJustTyped.trim().length === 0) return;

    const now = Date.now();
    if (now - this.lastTypeSfxAt < this.typeSfxCooldownMs) return;
    this.lastTypeSfxAt = now;

    try {
      this.typeSfx.currentTime = 0;
      this.typeSfx.play().catch(() => { });
    } catch { }
  }

  private primeAudio() {
    this.initTypeSfx();

    try {
      this.typeSfx?.play().then(() => {
        if (!this.typeSfx) return;
        this.typeSfx.pause();
        this.typeSfx.currentTime = 0;
      }).catch(() => { });
    } catch { }

  }

  private typeNarrativeThenShowOptions(fullText: string, turnIndex: number, speedMs = 55) {
    this.loading = false
    this.typing = true;
    if (this.typingTimer) clearInterval(this.typingTimer);

    this.initTypeSfx();

    this.response[turnIndex].narrativa = '';
    this.response[turnIndex].showOptions = false;

    let i = 0;

    const refresh = () => {

      this.cdr.detectChanges();

      if (this.content) {
        this.content.scrollToBottom(0);
      }
    };


    requestAnimationFrame(refresh);

    this.typingTimer = setInterval(() => {
      const ch = fullText.charAt(i);

      this.response[turnIndex].narrativa += ch;
      i++;

      this.playTypeSfx(ch);


      requestAnimationFrame(refresh);

      if (i >= fullText.length) {

        clearInterval(this.typingTimer);
        this.typingTimer = null;
        this.typing = false;

        if (this.game_ended != true) {
          this.disable_option_buttons = false;
        }

        this.response[turnIndex].showOptions = true;
        requestAnimationFrame(refresh);
      }
    }, speedMs);
  }


  async exitGameAlert() {
    const alert = await this.alertController.create({
      header: 'Salir de la partida',
      message: 'Perderás el progreso actual.',
      cssClass: 'pixel-alert',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Salir',
          handler: () => {
            this.clickSound();
            this.router.navigate(['/start-menu']);
          }
        }
      ]
    });

    await alert.present();
  }


  exitGame() {
    this.clickSound();
    this.exitGameAlert();
  }
}
