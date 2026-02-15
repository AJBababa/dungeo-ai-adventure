import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LorePage } from './lore.page';

describe('LorePage', () => {
  let component: LorePage;
  let fixture: ComponentFixture<LorePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LorePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
