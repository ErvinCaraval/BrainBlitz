import React, { Suspense } from 'react'
import { motion } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import Skeleton from './ui/Skeleton'

function LayoutSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

export default function Layout({ children }) {
  return (
    <div className="flex flex-col bg-bb-bg-primary min-h-screen text-white overflow-x-hidden">
      <Navbar />
      <motion.main
        className="flex-1 mx-auto px-4 py-6 w-full container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Suspense fallback={<LayoutSkeleton />}>
          {children}
        </Suspense>
      </motion.main>
      <Footer />
    </div>
  )
}
