import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'start-menu',
    pathMatch: 'full',
  },
  {
    path: 'game',
    loadComponent: () => import('./game/game.page').then( m => m.GamePage)
  },
  {
    path: 'start-menu',
    loadComponent: () => import('./start-menu/start-menu.page').then( m => m.StartMenuPage)
  },  {
    path: 'inventory',
    loadComponent: () => import('./inventory/inventory.page').then( m => m.InventoryPage)
  },
  {
    path: 'market',
    loadComponent: () => import('./market/market.page').then( m => m.MarketPage)
  },
  {
    path: 'characters',
    loadComponent: () => import('./characters/characters.page').then( m => m.CharactersPage)
  },
  {
    path: 'lore',
    loadComponent: () => import('./lore/lore.page').then( m => m.LorePage)
  },
  {
    path: 'tavern',
    loadComponent: () => import('./tavern/tavern.page').then( m => m.TavernPage)
  },

];
