import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import { ErrorObservable } from 'rxjs/observable/ErrorObservable';
import { catchError, retry } from 'rxjs/operators';

export interface Stay {
  name: string;
  fromDate: Date;
  toDate: Date;
}

export interface Conference {
  location: String;
  dates: String;
  link: String;
  name: String;
}

export interface Photo {
  text: String;
  url: String;
  link: String;
  posted: Date;
}

export interface Food {
  kcal: Number;
  carbs: Number;
  protein: Number;
  fat: Number;
}

interface FoodItem {
  name: String;
  amount: String;
}

export interface MyData {
  loading?: boolean;
  currentCityText?: string;
  nextCityText?: string;
  nextCityDate?: string;
  currentMoodEmoji?: string;
  currentMoodLevel?: string;
  currentMoodRelativeTime?: string;
  localTime?: string;
  mapsUrl?: string;
  profilePictureUrl?: string;
  lastCommitMessage?: String;
  lastCommitLink?: String;
  lastCommitTimestamp?: Date;
  todaysMacros?: Food;
  todaysFoodItems?: FoodItem[];
  numberOfTodoItems?: number;
  otherFxLifeData?: any;

  // Arrays
  nextStays?: Stay[];
  nextConferences?: Conference[];
  recentPhotos?: Photo[];
}

@Injectable()
export class DataService {
  constructor(private http: HttpClient) { }

  getData() {
    // TODO: Update the URL once we have api.whereisfelix.today
    return this.http.get<MyData>("https://where-is-felix-today-backend.herokuapp.com/api.json").pipe(
      retry(3), // retry a failed request up to 3 times
      catchError(this.handleError) // then handle the error
    );
  }

  private handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${error.error}`);
    }
    return null;
    // return an ErrorObservable with a user-facing error message
    // return new ErrorObservable(
    //   'Something bad happened; please try again later.');
  };
}
