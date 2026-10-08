import { Outlet } from '@tanstack/react-router';
import Nav from './nav';
import { Wordmark } from './ui/wordmark';
import User from './user';

export default function Layout() {
  return (
    <div className="relative h-screen w-full">
      <Wordmark />
      <User />
      <div className="absolute inset-0">
        <div className="max-w-180 mx-auto pt-27 px-7 pb-150px">
          <Outlet />
        </div>
      </div>
      <Nav />
    </div>
  );
}
