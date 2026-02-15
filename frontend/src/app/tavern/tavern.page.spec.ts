import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TavernPage } from './tavern.page';

describe('TavernPage', () => {
  let component: TavernPage;
  let fixture: ComponentFixture<TavernPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TavernPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
