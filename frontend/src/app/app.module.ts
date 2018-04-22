import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { RowItemComponent } from './row-item/row-item.component';

import { HttpClientModule } from '@angular/common/http'

import { DataService } from './data.service'


@NgModule({
  declarations: [
    AppComponent,
    RowItemComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [
    DataService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
