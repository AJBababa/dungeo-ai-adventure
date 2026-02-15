import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonText, IonCardHeader, IonItem, IonLabel, IonSelect, IonSelectOption, IonCard, IonCardContent, IonCardSubtitle, IonCardTitle, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-lore',
  templateUrl: './lore.page.html',
  styleUrls: ['./lore.page.scss'],
  standalone: true,
  imports: [IonButton, IonCardHeader, IonText, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonItem, IonLabel, IonSelect, IonSelectOption, IonCard, IonCardContent, IonCardSubtitle, IonCardTitle]
})
export class LorePage implements OnInit {
  private router = inject(Router);


  // public host_url: string = 'http://localhost:3000';
  public host_url = 'https://ddback-1.onrender.com';

  public universe: string = '';
  public characters: any[] = [];
  public places: any[] = [];
  activeSection: 'universe' | 'characters' | 'places' | null = null;

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadLore();
  }

  loadLore() {
    this.http.get<any>(this.host_url + '/api/lore').subscribe({
      next: (data) => {
        this.universe = data.universe || '';
        this.characters = this.parseCharacters(data.characters || '');
        this.places = this.parsePlaces(data.places || '');
        console.log('Universe:', this.universe);
        console.log('Characters:', this.characters);
        console.log('Places:', this.places);
      },
      error: (err) => console.error('Error cargando lore:', err)
    });
  }

  parseCharacters(charactersStr: string) {
    const entries = charactersStr.split(/\nNAME:/).filter(e => e.trim() !== '');
    return entries.map(entry => {
      const [nameLine, ...descLines] = entry.split(/\nDESCRIPTION:/);
      return { name: nameLine.trim(), description: descLines.join('\n').trim() };
    });
  }

  parsePlaces(placesStr: string) {
    const entries = placesStr.split(/\nNAME:/).filter(e => e.trim() !== '');
    return entries.map(entry => {
      const [nameLine, ...descLines] = entry.split(/\nDESCRIPTION:/);
      return { name: nameLine.trim(), description: descLines.join('\n').trim() };
    });
  }


  goBack() {
    this.router.navigate(['/start-menu']);
  }

}
