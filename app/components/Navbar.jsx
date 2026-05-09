const Navbar = () => {
  return (
    <nav className="bg-white border-b fixed top-0 left-0 right-0 z-50">
      <div className="px-4 h-16 flex justify-between items-center">
        <Link href="/" className="font-semibold text-lg">
          OBE System
        </Link>
      </div>
    </nav>
  )
}

export default Navbar