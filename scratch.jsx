          <div className="grid grid-cols-2 gap-4">
             <KYCCard kyc={user?.kyc_profile} onOpenModal={() => setShowKYCModal(true)} />
             
             {/* Total Benefits Card */}
             <div className="bg-surface-lowest rounded-xl p-5 border border-border-subtle flex flex-col justify-center">
               <div className="flex items-start justify-between mb-4">
                 <h3 className="font-bold text-text-primary font-sans text-sm">Total Benefits Received</h3>
                 <div className="w-8 h-8 rounded-full bg-tint-blue flex items-center justify-center">
                   <TrendingUp size={16} className="text-primary-override" />
                 </div>
               </div>
               <p className="text-3xl font-bold text-text-primary font-sans tracking-tight">₹{totalBenefits.toLocaleString('en-IN')}</p>
             </div>
          </div>
