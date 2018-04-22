import { Component } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { HttpEvent, HttpHandler, HttpInterceptor } from '@angular/common/http';
import { MyData, DataService } from './data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit {
  title = 'app';

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.refreshData();
  }

  data: MyData;

  refreshData() {
    this.dataService.getData()
      .subscribe(data => {
        console.log(data);
        this.data = { ...data };
      })
  }
}
